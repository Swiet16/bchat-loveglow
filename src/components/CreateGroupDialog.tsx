import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: Tables<'profiles'>;
  availableUsers: Tables<'profiles'>[];
  onGroupCreated: (conversationId: string) => void;
}

export const CreateGroupDialog = ({
  open,
  onOpenChange,
  currentUser,
  availableUsers,
  onGroupCreated,
}: CreateGroupDialogProps) => {
  const [groupName, setGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedUsers.length === 0) {
      toast({
        title: 'Missing information',
        description: 'Please enter a group name and select at least one member',
        variant: 'destructive',
      });
      return;
    }

    setCreating(true);
    try {
      // Create conversation
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          name: groupName,
          is_group: true,
          created_by: currentUser.id,
        })
        .select()
        .single();

      if (convError) throw convError;

      // Add current user and selected users as members
      const members = [currentUser.id, ...selectedUsers].map((userId) => ({
        conversation_id: conversation.id,
        user_id: userId,
      }));

      const { error: membersError } = await supabase
        .from('conversation_members')
        .insert(members);

      if (membersError) throw membersError;

      toast({
        title: 'Group created! 🎉',
        description: `${groupName} is ready to chat`,
      });

      onGroupCreated(conversation.id);
      setGroupName('');
      setSelectedUsers([]);
    } catch (error: any) {
      toast({
        title: 'Failed to create group',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const toggleUser = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md glass-effect">
        <DialogHeader>
          <DialogTitle className="gradient-text">Create New Group</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Group Name</label>
            <Input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g., Team Awesome"
              className="bg-muted/50 border-border"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">
              Add Members ({selectedUsers.length} selected)
            </label>
            <ScrollArea className="h-64 glass-effect rounded-lg p-2">
              <div className="space-y-2">
                {availableUsers.map((user) => (
                  <div
                    key={user.id}
                    onClick={() => toggleUser(user.id)}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={selectedUsers.includes(user.id)}
                      onCheckedChange={() => toggleUser(user.id)}
                    />
                    <Avatar className="w-10 h-10 border-2 border-primary/50">
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {user.display_name[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{user.display_name}</p>
                      {user.online_status && (
                        <p className="text-xs text-green-400">Online</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          <Button
            onClick={handleCreateGroup}
            disabled={creating || !groupName.trim() || selectedUsers.length === 0}
            className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90"
          >
            {creating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Group'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
