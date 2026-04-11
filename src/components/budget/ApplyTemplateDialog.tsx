import { useState } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { BudgetTemplate } from '@/lib/budgetTypes';
import { cn } from '@/lib/utils';

interface ApplyTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: BudgetTemplate[];
  defaultTemplateId?: string;
  onApply: (templateId: string) => void;
  currentMonth: string;
}

export function ApplyTemplateDialog({
  open,
  onOpenChange,
  templates,
  defaultTemplateId,
  onApply,
  currentMonth,
}: ApplyTemplateDialogProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    defaultTemplateId || null
  );

  const handleApply = () => {
    if (selectedTemplateId) {
      onApply(selectedTemplateId);
      onOpenChange(false);
      setSelectedTemplateId(defaultTemplateId || null);
    }
  };

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Apply Template</DialogTitle>
          <DialogDescription>
            Choose a template to apply to {currentMonth}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning about overwriting */}
          {templates.length > 0 && (
            <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/30">
              <CardContent className="pt-4">
                <div className="flex gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                      This will replace your current budget structure
                    </p>
                    <p className="text-xs text-amber-800 dark:text-amber-200 mt-1">
                      Any existing categories, line items, and transactions will be removed.
                      You can undo this by refreshing without saving.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Templates list */}
          {templates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No templates available</p>
              <p className="text-xs mt-1">Create a template first in the Template Manager</p>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-sm font-medium">Select a template:</label>
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-2 pr-4">
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => setSelectedTemplateId(template.id)}
                      className={cn(
                        'w-full p-3 rounded-lg border-2 transition-colors text-left',
                        selectedTemplateId === template.id
                          ? 'border-primary bg-primary/5'
                          : 'border-muted bg-muted/50 hover:bg-muted'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">
                              {template.name}
                            </p>
                            {defaultTemplateId === template.id && (
                              <Badge variant="secondary" className="text-xs shrink-0">
                                Default
                              </Badge>
                            )}
                          </div>
                          {template.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                              {template.description}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {template.buckets.length} categories
                          </p>
                        </div>

                        {selectedTemplateId === template.id && (
                          <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Template preview */}
          {selectedTemplate && (
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <h4 className="text-sm font-medium mb-2">Template Preview</h4>
                <div className="space-y-1">
                  {selectedTemplate.buckets.map((bucket) => (
                    <div key={bucket.id} className="text-xs">
                      <p className="font-medium text-foreground">
                        {bucket.name} ({bucket.lineItems.length} items)
                      </p>
                      <div className="ml-2 text-muted-foreground">
                        {bucket.lineItems.map((item) => (
                          <p key={item.id} className="text-xs">
                            • {item.name}
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Info box */}
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
            <p className="text-xs text-blue-900 dark:text-blue-100">
              <strong>💡 Tip:</strong> The template will only copy your category structure
              and line items. You'll need to set new amounts for each month based on your needs.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={!selectedTemplateId || templates.length === 0}
          >
            Apply Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
