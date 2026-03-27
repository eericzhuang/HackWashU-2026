import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createSession } from '@/lib/db';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface NewSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewSessionDialog({ open, onOpenChange }: NewSessionDialogProps) {
  const navigate = useNavigate();
  const [question, setQuestion] = useState('');
  const [skill, setSkill] = useState('');
  const [showSkill, setShowSkill] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (question.trim().length < 5) return;
    setLoading(true);
    try {
      const session = await createSession(question.trim(), skill.trim());
      onOpenChange(false);
      setQuestion('');
      setSkill('');
      setShowSkill(false);
      navigate(`/session/${session.id}`);
    } finally {
      setLoading(false);
    }
  }, [question, skill, navigate, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Exploration</DialogTitle>
          <DialogDescription>
            Enter a question to explore from multiple angles.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Textarea
            placeholder="Enter a question you want to explore..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="min-h-[100px]"
            autoFocus
          />

          <button
            type="button"
            onClick={() => setShowSkill((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showSkill ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            Background / Skill (optional)
          </button>

          {showSkill && (
            <Textarea
              placeholder="e.g. I'm a CS student interested in systems design..."
              value={skill}
              onChange={(e) => setSkill(e.target.value)}
              className="min-h-[60px] text-sm"
            />
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={handleSubmit}
            disabled={question.trim().length < 5 || loading}
          >
            {loading ? 'Creating...' : 'Start Exploring'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
