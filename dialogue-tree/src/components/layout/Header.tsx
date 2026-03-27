import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Session } from '@/types';
import { db } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ArrowLeft, Settings } from 'lucide-react';

interface HeaderProps {
  session: Session;
}

export function Header({ session }: HeaderProps) {
  const navigate = useNavigate();
  const [skillOpen, setSkillOpen] = useState(false);
  const [skillDraft, setSkillDraft] = useState(session.skill);

  const handleSaveSkill = async () => {
    await db.sessions.update(session.id, { skill: skillDraft });
    setSkillOpen(false);
  };

  return (
    <>
      <div className="shrink-0 h-11 px-4 border-b border-border flex items-center justify-between bg-card/80">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon-sm" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium text-foreground truncate">
            {session.title}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            setSkillDraft(session.skill);
            setSkillOpen(true);
          }}
        >
          <Settings className="w-4 h-4" />
        </Button>
      </div>

      <Dialog open={skillOpen} onOpenChange={setSkillOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Background / Skill</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Describe your background or preferences to tailor AI responses..."
            value={skillDraft}
            onChange={(e) => setSkillDraft(e.target.value)}
            className="min-h-[80px]"
          />
          <DialogFooter>
            <Button onClick={handleSaveSkill}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
