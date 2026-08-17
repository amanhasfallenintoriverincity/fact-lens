import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle2, AlertCircle, TrendingUp, Brain, Target, Loader2 } from 'lucide-react';
import type { AnalysisResults, FactCheckResult } from '@/types';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useRef } from 'react';
import { CitationLink } from './CitationLink';

gsap.registerPlugin(useGSAP);

export default function App() {
  const [results, setResults] = useState<AnalysisResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timestamp, setTimestamp] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadResults();
  }, []);

  useGSAP(() => {
    if (!containerRef.current || !results) return;

    gsap.from(containerRef.current.querySelectorAll('.animate-card'), {
      y: 20,
      opacity: 0,
      duration: 0.5,
      stagger: 0.1,
      ease: 'power2.out'
    });
  }, [results]);

  const loadResults = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getLastResults' });
      if (response.success) {
        setResults(response.data);
        setTimestamp(response.timestamp);
      } else {
        setError(response.message || '분석 결과가 없습니다');
      }
    } catch (err) {
      setError('결과를 불러오는 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (hasFactCheck: boolean) => {
    return hasFactCheck ? <CheckCircle2 className="w-4 h-4 text-blue-600" /> : <AlertCircle className="w-4 h-4 text-gray-400" />;
  };

  const getStatusText = (hasFactCheck: boolean) => {
    return hasFactCheck ? '팩트체크 자료 있음' : '팩트체크 자료 없음';
  };

  const getStatusColor = (hasFactCheck: boolean) => {
    return hasFactCheck 
      ? 'bg-blue-100/80 text-blue-800 border-blue-200/50 backdrop-blur-sm' 
      : 'bg-gray-100/80 text-gray-600 border-gray-200/50 backdrop-blur-sm';
  };

  const formatTime = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="w-[400px] min-h-[500px] flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="glass-strong rounded-2xl p-8">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
        </div>
      </div>
    );
  }

  if (error || !results) {
    return (
      <div className="w-[400px] min-h-[500px] flex items-center justify-center p-6 bg-gradient-to-br from-blue-50 to-purple-50">
        <Card className="glass-strong border-0">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 mb-4">{error || '분석 결과가 없습니다'}</p>
            <p className="text-sm text-gray-500">
              뉴스 기사에서 "Fact Lens로 팩트체크" 버튼을 클릭해주세요
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-[400px] min-h-[500px] bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header - Glass */}
      <div className="glass-strong p-4 border-b border-white/30">
        <h1 className="text-xl font-bold mb-1 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Fact Lens
        </h1>
        <p className="text-sm text-gray-600">
          {timestamp ? `분석 완료: ${formatTime(timestamp)}` : '분석 결과'}
        </p>
      </div>

      {/* Summary Scores - Glass Card */}
      {results.summary && (
        <Card className="m-4 animate-card glass border-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              종합 분석
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium">신뢰도</span>
                <span className="text-gray-600">{results.summary.trust}%</span>
              </div>
              <Progress value={results.summary.trust} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium">감정 안정성</span>
                <span className="text-gray-600">{results.summary.emotional}%</span>
              </div>
              <Progress value={results.summary.emotional} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium">중립성</span>
                <span className="text-gray-600">{results.summary.bias}%</span>
              </div>
              <Progress value={results.summary.bias} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs - Glass */}
      <Tabs defaultValue="emotions" className="m-4">
        <TabsList className="grid w-full grid-cols-3 glass-subtle border-0">
          <TabsTrigger value="emotions" className="data-[state=active]:glass-strong">감정</TabsTrigger>
          <TabsTrigger value="claims" className="data-[state=active]:glass-strong">주장</TabsTrigger>
          <TabsTrigger value="bias" className="data-[state=active]:glass-strong">편향성</TabsTrigger>
        </TabsList>

        {/* 감정 분석 */}
        <TabsContent value="emotions" className="mt-4">
          <Card className="animate-card glass border-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-600" />
                감정 분석
              </CardTitle>
            </CardHeader>
            <CardContent>
              {results.emotion && Object.keys(results.emotion).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(results.emotion)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5)
                    .map(([emotion, score]) => (
                      <div key={emotion}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium">{emotion}</span>
                          <span className="text-gray-600">{score}%</span>
                        </div>
                        <Progress value={score} className="h-2" />
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">
                  감정 분석 결과가 없습니다
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 주장 분석 */}
        <TabsContent value="claims" className="mt-4">
          <Card className="animate-card glass border-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="w-5 h-5 text-green-600" />
                팩트체크 결과
              </CardTitle>
            </CardHeader>
            <CardContent>
              {results.factcheck && results.factcheck.length > 0 ? (
                <div className="space-y-3">
                  {results.factcheck.map((claim: FactCheckResult, idx: number) => (
                    <div
                      key={idx}
                      className="p-3 glass-subtle rounded-lg"
                    >
                      <div className="flex items-start gap-2 mb-2">
                        {getStatusIcon(claim.hasFactCheck)}
                        <div className="flex-1">
                          <p className="text-sm font-medium mb-1">{claim.claim}</p>
                          <Badge
                            variant="outline"
                            className={`text-xs ${getStatusColor(claim.hasFactCheck)}`}
                          >
                            {getStatusText(claim.hasFactCheck)}
                          </Badge>
                        </div>
                      </div>
                      {claim.explanation && (
                        <p className="text-xs text-gray-600 mt-2 pl-6">
                          {claim.explanation}
                        </p>
                      )}
                      {claim.source && (
                        <CitationLink source={claim.source} url={claim.url} />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">
                  팩트체크 결과가 없습니다
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 편향성 분석 */}
        <TabsContent value="bias" className="mt-4">
          <Card className="animate-card glass border-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">편향성 분석</CardTitle>
            </CardHeader>
            <CardContent>
              {results.bias ? (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-medium">사실 vs 의견</span>
                    </div>
                    <div className="flex gap-2 text-xs">
                      <Badge variant="outline" className="bg-blue-50/80 backdrop-blur-sm">
                        사실 {results.bias.factOpinionRatio.fact}%
                      </Badge>
                      <Badge variant="outline" className="bg-purple-50/80 backdrop-blur-sm">
                        의견 {results.bias.factOpinionRatio.opinion}%
                      </Badge>
                    </div>
                  </div>

                  {results.bias.missingContext && results.bias.missingContext.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">누락된 맥락</p>
                      <ul className="space-y-1">
                        {results.bias.missingContext.map((ctx: string, idx: number) => (
                          <li key={idx} className="text-xs text-gray-600 flex items-start gap-2">
                            <span className="text-gray-400 mt-0.5">•</span>
                            <span>{ctx}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {results.bias.frame && (
                    <div>
                      <p className="text-sm font-medium mb-1">기사 프레임</p>
                      <Badge variant="outline" className="text-xs glass-subtle">
                        {results.bias.frame}
                      </Badge>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">
                  편향성 분석 결과가 없습니다
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <div className="p-4 text-center text-xs text-gray-500 glass-subtle mx-4 mb-4 rounded-lg">
        기사 본문에서 형광펜으로 표시된 주장을 클릭하면 상세 정보를 볼 수 있습니다
      </div>
    </div>
  );
}
