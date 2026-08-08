import { cn } from '@/lib/utils';
import { cleanMarkdown } from '@/lib/cleanMarkdown';

export interface ChatMessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
}

export function ChatMessageBubble({ role, content }: ChatMessageBubbleProps) {
  const isUser = role === 'user';
  const display = isUser ? content : cleanMarkdown(content);

  return (
    <div
      className={cn(
        'flex w-full',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'max-w-[85%] sm:max-w-[75%] px-4 py-3 rounded-lg text-sm leading-relaxed break-words whitespace-pre-wrap',
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-muted text-foreground rounded-bl-sm border border-border'
        )}
      >
        {display}
      </div>
    </div>
  );
}
