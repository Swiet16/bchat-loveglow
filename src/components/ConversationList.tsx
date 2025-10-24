import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { LogOut, MessageCircle, Plus, Users, Menu, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { CreateGroupDialog } from './CreateGroupDialog';
import type { Tables } from '@/integrations/supabase/types';

interface Conversation {
  id: string;
  name: string | null;
  is_group: boolean;
  members: Tables<'profiles'>[];
  last_message?: {
    content: string | null;
    created_at: string;
  };
}

interface ConversationListProps {
  currentUser: Tables<'profiles'>;
  onlineUsers: Tables<'profiles'>[];
  selectedConversation: string | null;
  onSelectConversation: (id: string) => void;
  onStartDirectMessage: (userId: string) => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export const ConversationList = ({
  currentUser,
  onlineUsers,
  selectedConversation,
  onSelectConversation,
  onStartDirectMessage,
  isMobileOpen,
  onCloseMobile,
}: ConversationListProps) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showUserList, setShowUserList] = useState(false);

  useEffect(() => {
    fetchConversations();

    const channel = supabase
      .channel('conversations-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, fetchConversations)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_members' }, fetchConversations)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, fetchConversations)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchConversations = async () => {
    const { data: convos } = await supabase
      .from('conversations')
      .select('*')
      .order('updated_at', { ascending: false });

    if (!convos) return;

    const conversationsWithDetails = await Promise.all(
      convos.map(async (convo) => {
        const { data: members } = await supabase
          .from('conversation_members')
          .select('user_id, profiles(*)')
          .eq('conversation_id', convo.id);

        const { data: lastMsg } = await supabase
          .from('messages')
          .select('content, created_at')
          .eq('conversation_id', convo.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        return {
          id: convo.id,
          name: convo.name,
          is_group: convo.is_group,
          members: members?.map((m: any) => m.profiles) || [],
          last_message: lastMsg || undefined,
        };
      })
    );

    setConversations(conversationsWithDetails);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const getConversationName = (convo: Conversation) => {
    if (convo.is_group) {
      return convo.name || 'Group Chat';
    }
    const otherUser = convo.members.find((m) => m.id !== currentUser.id);
    return otherUser?.display_name || 'Direct Message';
  };

  const getConversationAvatar = (convo: Conversation) => {
    if (!convo.is_group) {
      const otherUser = convo.members.find((m) => m.id !== currentUser.id);
      return otherUser;
    }
    return null;
  };

  const handleUserClick = async (userId: string) => {
    onStartDirectMessage(userId);
    setShowUserList(false);
    onCloseMobile();
  };

  const handleConversationClick = (id: string) => {
    onSelectConversation(id);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar */}
      <motion.div
        initial={false}
        animate={{
          x: isMobileOpen ? 0 : '-100%',
        }}
        className={`
          fixed lg:relative inset-y-0 left-0 z-50
          w-80 glass-effect border-r border-border 
          flex flex-col h-screen
          lg:translate-x-0
        `}
      >
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold gradient-text flex items-center gap-2">
              <MessageCircle className="w-6 h-6" />
              B-Chat
            </h1>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="hover:bg-destructive/20"
              >
                <LogOut className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onCloseMobile}
                className="lg:hidden hover:bg-muted"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Current User */}
          <div className="flex items-center gap-3 p-3 glass-effect rounded-xl mb-3">
            <Avatar className="w-12 h-12 border-2 border-primary">
              <AvatarImage src={currentUser.avatar_url || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground">
                {currentUser.display_name[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{currentUser.display_name}</p>
              <p className="text-xs text-green-400 flex items-center gap-1">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                Online
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={() => setShowCreateGroup(true)}
              className="flex-1 bg-gradient-to-r from-primary to-secondary hover:opacity-90"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Group
            </Button>
            <Button
              onClick={() => setShowUserList(!showUserList)}
              variant="outline"
              size="sm"
              className="border-primary/50"
            >
              <Users className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* User List or Conversations */}
        <ScrollArea className="flex-1 p-4">
          {showUserList ? (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground mb-3 px-2">
                Online Users ({onlineUsers.length})
              </h2>
              {onlineUsers
                .filter((user) => user.id !== currentUser.id)
                .map((user) => (
                  <motion.div
                    key={user.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    onClick={() => handleUserClick(user.id)}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <Avatar className="w-10 h-10 border-2 border-secondary/50">
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback className="bg-secondary text-secondary-foreground">
                        {user.display_name[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{user.display_name}</p>
                      <p className="text-xs text-green-400">Active now</p>
                    </div>
                  </motion.div>
                ))}
            </div>
          ) : (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground mb-3 px-2">
                Messages
              </h2>
              {conversations.map((convo) => {
                const otherUser = getConversationAvatar(convo);
                const isSelected = selectedConversation === convo.id;

                return (
                  <motion.div
                    key={convo.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    onClick={() => handleConversationClick(convo.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-colors cursor-pointer ${
                      isSelected ? 'bg-primary/20 border border-primary/50' : 'hover:bg-muted/50'
                    }`}
                  >
                    <Avatar className="w-12 h-12 border-2 border-primary/50">
                      {otherUser ? (
                        <>
                          <AvatarImage src={otherUser.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {otherUser.display_name[0].toUpperCase()}
                          </AvatarFallback>
                        </>
                      ) : (
                        <AvatarFallback className="bg-secondary text-secondary-foreground">
                          <Users className="w-6 h-6" />
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{getConversationName(convo)}</p>
                      {convo.last_message && (
                        <p className="text-xs text-muted-foreground truncate">
                          {convo.last_message.content || 'Image'}
                        </p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <p className="text-xs text-center text-muted-foreground">
            Built by <span className="gradient-text font-semibold">Myne7x</span>
          </p>
        </div>
      </motion.div>

      <CreateGroupDialog
        open={showCreateGroup}
        onOpenChange={setShowCreateGroup}
        currentUser={currentUser}
        availableUsers={onlineUsers.filter((u) => u.id !== currentUser.id)}
        onGroupCreated={(id) => {
          onSelectConversation(id);
          setShowCreateGroup(false);
        }}
      />
    </>
  );
};
