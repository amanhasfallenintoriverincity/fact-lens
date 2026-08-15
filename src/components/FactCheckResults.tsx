import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import type { FactCheckResult } from '@/types';

gsap.registerPlugin(useGSAP);

interface Props {
  results: FactCheckResult[];
}

export function FactCheckResults({ results }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!containerRef.current) return;

    gsap.from(containerRef.current.querySelectorAll('.factcheck-item'), {
      scale: 0.95,
      opacity: 0,
      duration: 0.4,
      stagger: 0.1,
      ease: 'back.out(1.7)',
    });
  }, { scope: containerRef });

  if (results.length === 0) {
    return null;
  }

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'verified':
        return {
          icon: CheckCircle2,
          label: '검증됨',
          variant: 'default' as const,
          className: 'bg-green-500 hover:bg-green-600',
        };
      case 'false':
        return {
          icon: XCircle,
          label: '거짓',
          variant: 'destructive' as const,
          className: 'bg-red-500 hover:bg-red-600',
        };
      default:
        return {
          icon: AlertCircle,
          label: '미확인',
          variant: 'secondary' as const,
          className: 'bg-orange-500 hover:bg-orange-600 text-white',
        };
    }
  };

  return (
    <Card ref={containerRef}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <span className="text-2xl">✅</span>
          팩트체크 결과
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {results.map((result, index) => {
          const config = getStatusConfig(result.status);
          const Icon = config.icon;

          return (
            <div
              key={index}
              className="factcheck-item p-4 rounded-lg border bg-card space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium flex-1">{result.claim}</p>
                <Badge className={config.className}>
                  <Icon className="w-3 h-3 mr-1" />
                  {config.label}
                </Badge>
              </div>
              {result.explanation && (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {result.explanation}
                </p>
              )}
              {result.source && (
                <p className="text-xs text-muted-foreground">
                  출처: {result.source}
                </p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
