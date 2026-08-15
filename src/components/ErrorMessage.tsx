import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

interface Props {
  message: string;
}

export function ErrorMessage({ message }: Props) {
  return (
    <Card className="border-destructive bg-destructive/10">
      <CardContent className="pt-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <p className="text-sm text-destructive font-medium">{message}</p>
        </div>
      </CardContent>
    </Card>
  );
}
