-- Create conversations table
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  is_group BOOLEAN DEFAULT false,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on conversations
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Create conversation_members table
CREATE TABLE public.conversation_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

-- Enable RLS on conversation_members
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;

-- Update messages table to link to conversations
ALTER TABLE public.messages 
ADD COLUMN conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE;

-- Policies for conversations
CREATE POLICY "Users can view conversations they are members of"
  ON public.conversations FOR SELECT
  USING (
    id IN (
      SELECT conversation_id FROM public.conversation_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can create conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Conversation creators can update their conversations"
  ON public.conversations FOR UPDATE
  USING (created_by = auth.uid());

-- Policies for conversation_members
CREATE POLICY "Users can view members of their conversations"
  ON public.conversation_members FOR SELECT
  USING (
    conversation_id IN (
      SELECT conversation_id FROM public.conversation_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can join conversations"
  ON public.conversation_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave conversations"
  ON public.conversation_members FOR DELETE
  USING (auth.uid() = user_id);

-- Update messages policies to use conversations
DROP POLICY "Messages are viewable by everyone" ON public.messages;
DROP POLICY "Authenticated users can insert messages" ON public.messages;

CREATE POLICY "Users can view messages in their conversations"
  ON public.messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT conversation_id FROM public.conversation_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can send messages to their conversations"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    conversation_id IN (
      SELECT conversation_id FROM public.conversation_members 
      WHERE user_id = auth.uid()
    )
  );

-- Function to get or create direct conversation between two users
CREATE OR REPLACE FUNCTION public.get_or_create_direct_conversation(
  user1_id UUID,
  user2_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conversation_id UUID;
BEGIN
  -- Try to find existing direct conversation between these two users
  SELECT c.id INTO conversation_id
  FROM conversations c
  WHERE c.is_group = false
    AND (
      SELECT COUNT(*) FROM conversation_members cm 
      WHERE cm.conversation_id = c.id
    ) = 2
    AND EXISTS (
      SELECT 1 FROM conversation_members cm1 
      WHERE cm1.conversation_id = c.id AND cm1.user_id = user1_id
    )
    AND EXISTS (
      SELECT 1 FROM conversation_members cm2 
      WHERE cm2.conversation_id = c.id AND cm2.user_id = user2_id
    )
  LIMIT 1;

  -- If no conversation exists, create one
  IF conversation_id IS NULL THEN
    INSERT INTO conversations (is_group, created_by)
    VALUES (false, user1_id)
    RETURNING id INTO conversation_id;

    -- Add both users to the conversation
    INSERT INTO conversation_members (conversation_id, user_id)
    VALUES (conversation_id, user1_id), (conversation_id, user2_id);
  END IF;

  RETURN conversation_id;
END;
$$;

-- Trigger to update conversations updated_at
CREATE TRIGGER on_conversation_updated
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;

ALTER TABLE public.conversations REPLICA IDENTITY FULL;
ALTER TABLE public.conversation_members REPLICA IDENTITY FULL;

-- Create a global conversation for existing messages
DO $$
DECLARE
  global_conv_id UUID;
BEGIN
  INSERT INTO conversations (name, is_group, created_by)
  VALUES ('Global Chat', true, NULL)
  RETURNING id INTO global_conv_id;

  -- Add all existing users to global conversation
  INSERT INTO conversation_members (conversation_id, user_id)
  SELECT global_conv_id, id FROM profiles;

  -- Link all existing messages to global conversation
  UPDATE messages SET conversation_id = global_conv_id WHERE conversation_id IS NULL;
END $$;