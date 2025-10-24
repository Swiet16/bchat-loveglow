import { motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { LogOut, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

interface ChatSidebarProps {
  currentUser: Tables<'profiles'> | null;
  onlineUsers: Tables<'profiles'>[];
}

export const ChatSidebar = ({ currentUser, onlineUsers }: ChatSidebarProps) => {
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <motion.div
      initial={{ x: -300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="w-80 glass-effect border-r border-border flex flex-col h-screen"
    >
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold gradient-text flex items-center gap-2">
            <MessageCircle className="w-6 h-6" />
            B-Chat
          </h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="hover:bg-destructive/20"
          >
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
        
        {/* Current User */}
        {currentUser && (
          <div className="flex items-center gap-3 p-3 glass-effect rounded-xl">
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
        )}
      </div>

      {/* Online Users */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground mb-3 px-2">
            Online Users ({onlineUsers.length})
          </h2>
          {onlineUsers.map((user) => (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
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
                <p className="text-xs text-muted-foreground">Active now</p>
              </div>
              {user.online_status && (
                <span className="w-3 h-3 bg-green-400 rounded-full"></span>
              )}
            </motion.div>
          ))}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <p className="text-xs text-center text-muted-foreground">
          Built by <span className="gradient-text font-semibold">Myne7x</span>
        </p>
      </div>
    </motion.div>
  );
};
