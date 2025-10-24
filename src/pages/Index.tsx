import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AuthPage } from '@/components/AuthPage';
import { ConversationList } from '@/components/ConversationList';
import { ConversationView } from '@/components/ConversationView';
import { LoadingScreen } from '@/components/LoadingScreen';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [currentProfile, setCurrentProfile] = useState<Tables<'profiles'> | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Tables<'profiles'>[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Set up auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        setTimeout(() => {
          fetchCurrentProfile(session.user.id);
          updateOnlineStatus(session.user.id, true);
        }, 0);
      }
    });

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchCurrentProfile(session.user.id);
        updateOnlineStatus(session.user.id, true);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
      if (user) {
        updateOnlineStatus(user.id, false);
      }
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    fetchOnlineUsers();

    const channel = supabase
      .channel('profiles-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchOnlineUsers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchCurrentProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();

    if (data) {
      setCurrentProfile(data);
    }
  };

  const fetchOnlineUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('online_status', true)
      .order('display_name');

    if (data) {
      setOnlineUsers(data);
    }
  };

  const updateOnlineStatus = async (userId: string, status: boolean) => {
    await supabase
      .from('profiles')
      .update({ online_status: status, last_seen: new Date().toISOString() })
      .eq('id', userId);
  };

  const handleStartDirectMessage = async (userId: string) => {
    if (!currentProfile) return;

    try {
      const { data, error } = await supabase.rpc('get_or_create_direct_conversation', {
        user1_id: currentProfile.id,
        user2_id: userId,
      });

      if (error) throw error;

      setSelectedConversation(data);
      toast({
        title: 'Direct message started',
        description: 'You can now chat privately',
      });
    } catch (error: any) {
      toast({
        title: 'Failed to start conversation',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleToggleSidebar = () => {
    setIsMobileSidebarOpen(!isMobileSidebarOpen);
  };

  const handleCloseMobileSidebar = () => {
    setIsMobileSidebarOpen(false);
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user || !session) {
    return <AuthPage />;
  }

  if (!currentProfile) {
    return <LoadingScreen />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <ConversationList
        currentUser={currentProfile}
        onlineUsers={onlineUsers}
        selectedConversation={selectedConversation}
        onSelectConversation={setSelectedConversation}
        onStartDirectMessage={handleStartDirectMessage}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={handleCloseMobileSidebar}
      />
      <ConversationView
        conversationId={selectedConversation}
        currentUser={currentProfile}
        onToggleSidebar={handleToggleSidebar}
      />
    </div>
  );
};

export default Index;
