import { cn } from '@/lib/utils';

export interface ChatMessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
}

export function ChatMessageBubble({ role, content }: ChatMessageBubbleProps) {
  const isUser = role === 'user';

  return (
    <div
      className={cn(
        'flex w-full',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'max-w-[80%] sm:max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed',
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-md'
            : 'bg-muted text-foreground rounded-bl-md border border-border/60'
        )}
      >
        {content.split('\n').map((line, i) => (
          <span key={i} className="block">
            {line}
          </span>
        ))}
      </div>
    </div>
  );
}
