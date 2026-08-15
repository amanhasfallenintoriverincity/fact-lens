import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Settings } from 'lucide-react';

interface Props {
  onAnalyze: () => void;
  disabled: boolean;
}

export function Footer({ onAnalyze, disabled }: Props) {
  const handleSettings = () => {
    chrome.runtime.openOptionsPage();
  };

  return (
    <Card className="border-t border-border rounded-none">
      <CardContent className="pt-6 flex gap-2">
        <Button
          onClick={onAnalyze}
          disabled={disabled}
          className="flex-1"
          size="lg"
        >
          <Search className="w-4 h-4 mr-2" />
          현재 기사 분석
        </Button>
        <Button
          onClick={handleSettings}
          variant="outline"
          size="icon"
        >
          <Settings className="w-4 h-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
