import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Image as ImageIcon, Loader2, Menu, Users, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';

interface Message extends Tables<'messages'> {
  profiles: Tables<'profiles'>;
}

interface ConversationViewProps {
  conversationId: string | null;
  currentUser: Tables<'profiles'>;
  onToggleSidebar: () => void;
}

export const ConversationView = ({
  conversationId,
  currentUser,
  onToggleSidebar,
}: ConversationViewProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [conversationInfo, setConversationInfo] = useState<any>(null);
  const [members, setMembers] = useState<Tables<'profiles'>[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!conversationId) return;

    fetchConversationInfo();
    fetchMessages();

    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', payload.new.sender_id)
            .single();

          if (profile) {
            setMessages((prev) => [...prev, { ...payload.new, profiles: profile } as Message]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchConversationInfo = async () => {
    if (!conversationId) return;

    const { data: conv } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    const { data: memberData } = await supabase
      .from('conversation_members')
      .select('user_id, profiles(*)')
      .eq('conversation_id', conversationId);

    if (conv) setConversationInfo(conv);
    if (memberData) {
      setMembers(memberData.map((m: any) => m.profiles));
    }
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const fetchMessages = async () => {
    if (!conversationId) return;

    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        profiles (*)
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      toast({
        title: 'Error loading messages',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setMessages(data as Message[]);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending || !conversationId) return;

    setSending(true);
    const { error } = await supabase.from('messages').insert({
      sender_id: currentUser.id,
      content: newMessage.trim(),
      conversation_id: conversationId,
    });

    if (error) {
      toast({
        title: 'Failed to send message',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setNewMessage('');
    }
    setSending(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !conversationId) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an image file',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${currentUser.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('chat-images')
      .upload(filePath, file);

    if (uploadError) {
      toast({
        title: 'Upload failed',
        description: uploadError.message,
        variant: 'destructive',
      });
      setUploading(false);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('chat-images').getPublicUrl(filePath);

    const { error: messageError } = await supabase.from('messages').insert({
      sender_id: currentUser.id,
      image_url: publicUrl,
      conversation_id: conversationId,
    });

    if (messageError) {
      toast({
        title: 'Failed to send image',
        description: messageError.message,
        variant: 'destructive',
      });
    }

    setUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const getConversationTitle = () => {
    if (!conversationInfo) return 'Select a conversation';
    if (conversationInfo.is_group) {
      return conversationInfo.name || 'Group Chat';
    }
    const otherUser = members.find((m) => m.id !== currentUser.id);
    return otherUser?.display_name || 'Direct Message';
  };

  const getConversationSubtitle = () => {
    if (!conversationInfo) return '';
    if (conversationInfo.is_group) {
      return `${members.length} members`;
    }
    const otherUser = members.find((m) => m.id !== currentUser.id);
    return otherUser?.online_status ? 'Active now' : 'Offline';
  };

  if (!conversationId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-screen p-4">
        <Button
          onClick={onToggleSidebar}
          variant="outline"
          size="icon"
          className="lg:hidden mb-4"
        >
          <Menu className="w-5 h-5" />
        </Button>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <Users className="w-20 h-20 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold gradient-text mb-2">Welcome to B-Chat 💬</h2>
          <p className="text-muted-foreground max-w-sm">
            Select a conversation or start a new one to begin chatting
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-screen">
      {/* Header */}
      <div className="p-4 glass-effect border-b border-border">
        <div className="flex items-center gap-3">
          <Button
            onClick={onToggleSidebar}
            variant="ghost"
            size="icon"
            className="lg:hidden"
          >
            <Menu className="w-5 h-5" />
          </Button>

          {conversationInfo && !conversationInfo.is_group && (
            <Avatar className="w-10 h-10 border-2 border-primary/50">
              {(() => {
                const otherUser = members.find((m) => m.id !== currentUser.id);
                return (
                  <>
                    <AvatarImage src={otherUser?.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {otherUser?.display_name?.[0].toUpperCase() || 'U'}
                    </AvatarFallback>
                  </>
                );
              })()}
            </Avatar>
          )}

          {conversationInfo && conversationInfo.is_group && (
            <div className="w-10 h-10 rounded-full bg-secondary/20 border-2 border-secondary/50 flex items-center justify-center">
              <Users className="w-5 h-5 text-secondary" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold truncate">{getConversationTitle()}</h2>
            <p className="text-sm text-muted-foreground truncate">{getConversationSubtitle()}</p>
          </div>

          <Button variant="ghost" size="icon" className="hidden sm:flex">
            <Info className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4 max-w-4xl mx-auto">
          <AnimatePresence>
            {messages.map((message) => {
              const isOwn = message.sender_id === currentUser.id;
              return (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <Avatar className="w-8 h-8 sm:w-10 sm:h-10 border-2 border-primary/50">
                    <AvatarImage src={message.profiles.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                      {message.profiles.display_name[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div
                    className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[75%] sm:max-w-[70%]`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs sm:text-sm font-medium">
                        {message.profiles.display_name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(message.created_at)}
                      </span>
                    </div>

                    <div
                      className={`rounded-2xl p-3 sm:p-4 ${
                        isOwn
                          ? 'bg-gradient-to-r from-primary to-secondary text-primary-foreground'
                          : 'glass-effect'
                      }`}
                    >
                      {message.content && <p className="text-sm sm:text-base break-words">{message.content}</p>}
                      {message.image_url && (
                        <img
                          src={message.image_url}
                          alt="Shared image"
                          className="rounded-lg mt-2 max-w-full"
                        />
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-3 sm:p-4 glass-effect border-t border-border">
        <form onSubmit={handleSendMessage} className="flex gap-2 max-w-4xl mx-auto">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="hover:bg-muted flex-shrink-0"
          >
            {uploading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <ImageIcon className="w-5 h-5" />
            )}
          </Button>

          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-muted/50 border-border"
            disabled={sending}
          />

          <Button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="bg-gradient-to-r from-primary to-secondary hover:opacity-90 flex-shrink-0"
          >
            {sending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};
