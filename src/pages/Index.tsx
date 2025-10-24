import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AuthPage } from '@/components/AuthPage';
import { ChatSidebar } from '@/components/ChatSidebar';
import { ChatWindow } from '@/components/ChatWindow';
import { LoadingScreen } from '@/components/LoadingScreen';
import type { Tables } from '@/integrations/supabase/types';

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [currentProfile, setCurrentProfile] = useState<Tables<'profiles'> | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Tables<'profiles'>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(() => {
            fetchCurrentProfile(session.user.id);
            updateOnlineStatus(session.user.id, true);
          }, 0);
        }
      }
    );

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
      .channel('profiles-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles'
        },
        () => {
          fetchOnlineUsers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchCurrentProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
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
    <div className="flex h-screen overflow-hidden">
      <ChatSidebar currentUser={currentProfile} onlineUsers={onlineUsers} />
      <ChatWindow currentUser={currentProfile} />
    </div>
  );
};

export default Index;
