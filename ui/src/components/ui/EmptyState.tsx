import { ComponentType, ReactNode } from "react";
import { Inbox } from "lucide-react";
import Button from "./Button";

interface EmptyStateProps {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export default function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: EmptyStateProps): ReactNode {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon className="mb-4 h-12 w-12 text-gray-200" />
      <h3 className="mb-1 text-sm font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mb-4 max-w-xs text-sm text-muted">{description}</p>
      )}
      {action && (
        <Button size="sm" onClick={action.onClick} className="mt-2">
          {action.label}
        </Button>
      )}
    </div>
  );
}
