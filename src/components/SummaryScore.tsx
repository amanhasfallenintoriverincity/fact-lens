import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { SummaryScores } from '@/types';

gsap.registerPlugin(useGSAP);

interface Props {
  summary: SummaryScores;
}

export function SummaryScore({ summary }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!containerRef.current) return;

    gsap.from(containerRef.current.querySelectorAll('.score-item'), {
      scale: 0.8,
      opacity: 0,
      duration: 0.6,
      stagger: 0.15,
      ease: 'back.out(1.7)',
    });
  }, { scope: containerRef });

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <Card ref={containerRef} className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <span className="text-2xl">📊</span>
          종합 분석
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <div className="score-item text-center space-y-2">
            <div className={`text-3xl font-bold ${getScoreColor(summary.trust)}`}>
              {summary.trust}
            </div>
            <div className="text-xs text-muted-foreground font-medium">
              신뢰도
            </div>
          </div>
          <div className="score-item text-center space-y-2">
            <div className={`text-3xl font-bold ${getScoreColor(summary.emotional)}`}>
              {summary.emotional}
            </div>
            <div className="text-xs text-muted-foreground font-medium">
              감정 안정성
            </div>
          </div>
          <div className="score-item text-center space-y-2">
            <div className={`text-3xl font-bold ${getScoreColor(summary.bias)}`}>
              {summary.bias}
            </div>
            <div className="text-xs text-muted-foreground font-medium">
              중립성
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
