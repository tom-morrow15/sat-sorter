import { useState } from 'react';
import { Plus, Trash2, Star, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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

interface ManageBudgetTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: BudgetTemplate[];
  defaultTemplateId?: string;
  onSaveTemplate: (name: string, description?: string) => void;
  onUpdateTemplate: (templateId: string, name: string, description?: string) => void;
  onDeleteTemplate: (templateId: string) => void;
  onSetDefaultTemplate: (templateId: string) => void;
  currentBudgetName?: string;
}

export function ManageBudgetTemplateDialog({
  open,
  onOpenChange,
  templates,
  defaultTemplateId,
  onSaveTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  onSetDefaultTemplate,
  currentBudgetName = 'Current Budget',
}: ManageBudgetTemplateDialogProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');

  const handleSave = () => {
    if (templateName.trim()) {
      if (editingId) {
        onUpdateTemplate(editingId, templateName.trim(), templateDescription.trim() || undefined);
        setEditingId(null);
      } else {
        onSaveTemplate(templateName.trim(), templateDescription.trim() || undefined);
        setIsCreating(false);
      }
      setTemplateName('');
      setTemplateDescription('');
    }
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingId(null);
    setTemplateName('');
    setTemplateDescription('');
  };

  const handleEditTemplate = (template: BudgetTemplate) => {
    setEditingId(template.id);
    setTemplateName(template.name);
    setTemplateDescription(template.description || '');
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Budget Templates</DialogTitle>
          <DialogDescription>
            Save your current budget structure as a template to reuse for future months
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Save current budget as template */}
          {!isCreating && !editingId && (
            <Button
              className="w-full"
              onClick={() => setIsCreating(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Save {currentBudgetName} as Template
            </Button>
          )}

          {/* Create/Edit template form */}
          {(isCreating || editingId) && (
            <Card>
              <CardContent className="pt-6 space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="template-name">Template Name</Label>
                  <Input
                    id="template-name"
                    placeholder="e.g., Standard Household Budget"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="template-description">Description (Optional)</Label>
                  <Textarea
                    id="template-description"
                    placeholder="Add notes about this template..."
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                    rows={2}
                    className="resize-none"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={!templateName.trim()}
                  >
                    {editingId ? 'Update' : 'Save'} Template
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancel}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Templates list */}
          <div className="space-y-2">
            <Label>Your Templates ({templates.length})</Label>
            {templates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No templates yet</p>
                <p className="text-xs mt-1">Save your current budget as a template to get started</p>
              </div>
            ) : (
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-2 pr-4">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className={cn(
                        'p-3 rounded-lg border transition-colors',
                        defaultTemplateId === template.id
                          ? 'bg-primary/10 border-primary/30'
                          : 'bg-muted/50'
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
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {template.description}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {template.buckets.length} categories • Updated {formatDate(template.updatedAt)}
                          </p>
                        </div>

                        <div className="flex gap-1 shrink-0">
                          {defaultTemplateId !== template.id && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => onSetDefaultTemplate(template.id)}
                              title="Set as default"
                            >
                              <Star className="h-4 w-4" />
                            </Button>
                          )}

                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => handleEditTemplate(template)}
                            title="Edit template"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>

                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => onDeleteTemplate(template.id)}
                            title="Delete template"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Info box */}
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
            <p className="text-xs text-blue-900 dark:text-blue-100">
              <strong>💡 Tip:</strong> Save your budget structure as a template, then use
              "Apply Template" when creating a new month to quickly set up your categories
              and line items. You can adjust amounts month-to-month as needed.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
