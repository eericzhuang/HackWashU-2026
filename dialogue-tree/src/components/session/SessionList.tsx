import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, deleteSession } from '@/lib/db';
import { NewSessionDialog } from '@/components/session/NewSessionDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus, Trash2, GitFork, Sun, Moon } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

export function SessionList() {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const { theme, toggleTheme } = useTheme();

  const sessions = useLiveQuery(
    () => db.sessions.orderBy('updatedAt').reverse().toArray()
  );

  const nodeCounts = useLiveQuery(async () => {
    if (!sessions) return {};
    const counts: Record<string, number> = {};
    for (const s of sessions) {
      counts[s.id] = await db.nodes.where({ sessionId: s.id }).count();
    }
    return counts;
  }, [sessions]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteSession(id);
    setConfirmDeleteId(null);
  }, []);

  return (
    <div className="h-screen min-w-[900px] bg-background flex flex-col">
      {/* Top bar */}
      <div className="shrink-0 px-6 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <GitFork className="w-4 h-4 text-primary" />
          </div>
          <h1 className="text-lg font-semibold text-foreground tracking-tight">Dialogue Divergence Tree</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" onClick={toggleTheme} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
          <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-1.5">
            <Plus className="w-4 h-4" />
            New Exploration
          </Button>
        </div>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-auto p-6">
        {!sessions || sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
              <GitFork className="w-8 h-8 text-primary/50" />
            </div>
            <p className="text-foreground font-medium mb-1">No explorations yet</p>
            <p className="text-muted-foreground text-sm mb-6 max-w-xs">
              Start by asking a question to explore from multiple angles. Each answer branches into new perspectives.
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-1" />
              New Exploration
            </Button>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-3">
            {sessions.map((session) => (
              <Card
                key={session.id}
                className="p-4 cursor-pointer hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 transition-all duration-200 group"
                onClick={() => navigate(`/session/${session.id}`)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                      {session.title}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      <span>{new Date(session.createdAt).toLocaleDateString()}</span>
                      <span className="flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                        {nodeCounts?.[session.id] ?? 0} nodes
                      </span>
                    </div>
                  </div>

                  {confirmDeleteId === session.id ? (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(session.id)}
                      >
                        Delete
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteId(session.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <NewSessionDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
