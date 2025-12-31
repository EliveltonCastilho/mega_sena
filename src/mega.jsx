import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, 
  Grid3X3, 
  Settings2, 
  RotateCcw, 
  ChevronRight, 
  ShieldCheck, 
  AlertTriangle,
  Info,
  Database,
  Activity,
  Calculator,
  Wifi,
  WifiOff,
  Calendar,
  DollarSign,
  TrendingUp,
  DownloadCloud,
  Trash2,
  MousePointerClick,
  X
} from 'lucide-react';

// Constantes do Jogo
const TOTAL_NUMBERS = 60;
const DRAW_COUNT = 6;

const App = () => {
  const [numbers, setNumbers] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [filters, setFilters] = useState({
    sumRange: true,
    quadrants: true,
    parity: true
  });

  // Estados de Dados
  const [history, setHistory] = useState([]); // Histórico completo
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [realStats, setRealStats] = useState(null); // Estatísticas calculadas do histórico

  // Estados para Último Sorteio (API Real)
  const [latestDraw, setLatestDraw] = useState(null);
  const [loadingReal, setLoadingReal] = useState(false);

  // Estado para Modal de Análise de Soma
  const [selectedSum, setSelectedSum] = useState(null);
  const [sumAnalysis, setSumAnalysis] = useState(null);

  // Estado para Gerador por Soma
  const [targetSum, setTargetSum] = useState('');
  const [isGeneratingBySum, setIsGeneratingBySum] = useState(false);

  // --- 1. Inicialização e Download de Dados ---

  useEffect(() => {
    // Carregar dados assim que o app abre
    fetchFullHistory();
  }, []);

  const fetchFullHistory = async () => {
    setLoadingHistory(true);
    try {
      // Tenta pegar TODA a base de dados
      const response = await fetch('https://loteriascaixa-api.herokuapp.com/api/megasena');
      if (!response.ok) throw new Error('Falha ao baixar histórico');
      
      const data = await response.json();
      
      // Processamento pesado: Calcular estatísticas de TODOS os jogos passados
      processHistoryData(data);
      setHistory(data);
      
      // Define o último sorteio com base no histórico baixado
      const latest = data.reduce((prev, current) => (prev.concurso > current.concurso) ? prev : current);
      setLatestDraw({
        ...latest,
        dezenas: latest.dezenas.map(d => parseInt(d, 10))
      });

    } catch (error) {
      console.error("Erro ao processar histórico:", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const processHistoryData = (data) => {
    const sumFrequencies = {};
    const numberCounts = {}; // Frequência individual de cada número (1-60)
    const parityCounts = { evens: 0, odds: 0, total: 0 };
    let minSum = 999;
    let maxSum = 0;

    // Inicializar contagem de números
    for (let i = 1; i <= 60; i++) numberCounts[i] = 0;

    data.forEach(draw => {
      // Normalizar dezenas para inteiros
      const dezenas = draw.dezenas.map(d => parseInt(d, 10));
      
      // 1. Contagem Individual (Espectro Numérico)
      dezenas.forEach(num => {
        if (numberCounts[num] !== undefined) numberCounts[num]++;
      });

      // 2. Soma
      const sum = dezenas.reduce((a, b) => a + b, 0);
      sumFrequencies[sum] = (sumFrequencies[sum] || 0) + 1;
      if (sum < minSum) minSum = sum;
      if (sum > maxSum) maxSum = sum;

      // 3. Paridade
      const evens = dezenas.filter(n => n % 2 === 0).length;
      parityCounts.total += 6; // 6 números por jogo
      parityCounts.evens += evens;
      parityCounts.odds += (6 - evens);
    });

    setRealStats({
      sumFrequencies,
      numberCounts,
      minSum,
      maxSum,
      totalDraws: data.length,
      parity: {
        evensPct: (parityCounts.evens / parityCounts.total) * 100,
        oddsPct: (parityCounts.odds / parityCounts.total) * 100
      }
    });
  };

  // --- 2. Lógica de Negócio ---

  const getQuadrant = (n) => {
    const row = Math.floor((n - 1) / 10);
    const col = (n - 1) % 10;
    if (row < 3 && col < 5) return 1;
    if (row < 3 && col >= 5) return 2;
    if (row >= 3 && col < 5) return 3;
    return 4;
  };

  const toggleNumber = (num) => {
    if (numbers.includes(num)) {
      setNumbers(numbers.filter(n => n !== num).sort((a, b) => a - b));
    } else {
      if (numbers.length < DRAW_COUNT) {
        setNumbers([...numbers, num].sort((a, b) => a - b));
      }
    }
  };

  const clearSelection = () => {
    setNumbers([]);
  };

  const currentStats = useMemo(() => {
    if (numbers.length === 0) return null;
    
    const sum = numbers.reduce((a, b) => a + b, 0);
    const evens = numbers.filter(n => n % 2 === 0).length;
    const odds = numbers.length - evens; // Baseado nos selecionados
    
    const quadrantCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
    numbers.forEach(n => quadrantCounts[getQuadrant(n)]++);
    const activeQuadrants = Object.values(quadrantCounts).filter(c => c > 0).length;

    // Calcular probabilidade histórica dessa soma específica
    let historicalFrequency = 0;
    if (realStats && realStats.sumFrequencies[sum]) {
        historicalFrequency = realStats.sumFrequencies[sum];
    }

    return { sum, evens, odds, quadrantCounts, activeQuadrants, historicalFrequency };
  }, [numbers, realStats]);

  // Nova Função: Gera o Veredito Dinâmico
  const getVerdict = () => {
    if (numbers.length < 6) return {
      status: 'waiting',
      text: `Selecione mais ${6 - numbers.length} números para análise completa.`,
      icon: Info,
      color: 'text-slate-400',
      bg: 'bg-slate-900',
      border: 'border-slate-800'
    };

    const { sum, activeQuadrants, evens } = currentStats;
    const issues = [];

    // Validar Soma (Zona de Ouro: 150 - 210)
    if (sum < 150) issues.push(`Soma ${sum} muito baixa (abaixo de 150).`);
    if (sum > 210) issues.push(`Soma ${sum} muito alta (acima de 210).`);

    // Validar Quadrantes (Minimo 3)
    if (activeQuadrants < 3) issues.push(`Concentração perigosa em apenas ${activeQuadrants} quadrantes.`);

    // Validar Paridade (Evitar extremos como 6P ou 6I)
    if (evens === 0 || evens === 6) issues.push(`Desequilíbrio total de Paridade (${evens} Pares).`);

    if (issues.length === 0) {
      return {
        status: 'good',
        text: `Excelente! Sua aposta está perfeitamente alinhada com o padrão histórico. A soma ${sum} está na Zona de Ouro e a distribuição é equilibrada.`,
        icon: ShieldCheck,
        color: 'text-emerald-400',
        bg: 'bg-slate-900',
        border: 'border-emerald-500/30'
      };
    } else {
      return {
        status: 'warning',
        text: `Cuidado: Detectamos anomalias estatísticas. ${issues.join(" ")} Isso coloca seu jogo nas "extremidades raras" da curva de probabilidade.`,
        icon: AlertTriangle,
        color: 'text-orange-400',
        bg: 'bg-orange-950/10',
        border: 'border-orange-500/30'
      };
    }
  };

  const verdict = useMemo(() => getVerdict(), [numbers, currentStats]);

  const generateNumbers = () => {
    setIsGenerating(true);
    setNumbers([]); // Limpa antes de gerar
    setTimeout(() => {
      let result = [];
      let attempts = 0;
      let found = false;

      while (!found && attempts < 2000) {
        attempts++;
        const candidate = [];
        while (candidate.length < DRAW_COUNT) {
          const r = Math.floor(Math.random() * TOTAL_NUMBERS) + 1;
          if (!candidate.includes(r)) candidate.push(r);
        }
        candidate.sort((a, b) => a - b);

        const cSum = candidate.reduce((a, b) => a + b, 0);
        const cEvens = candidate.filter(n => n % 2 === 0).length;
        const cQuads = new Set(candidate.map(n => getQuadrant(n))).size;

        const passSum = !filters.sumRange || (cSum >= 150 && cSum <= 210);
        const passParity = !filters.parity || (cEvens >= 2 && cEvens <= 4);
        const passQuads = !filters.quadrants || (cQuads >= 3);

        if (passSum && passParity && passQuads) {
          result = candidate;
          found = true;
        }
      }

      if (!found) {
        const fallback = [];
        while (fallback.length < DRAW_COUNT) {
          const r = Math.floor(Math.random() * TOTAL_NUMBERS) + 1;
          if (!fallback.includes(r)) fallback.push(r);
        }
        result = fallback.sort((a, b) => a - b);
      }

      setNumbers(result);
      setIsGenerating(false);
    }, 600);
  };

  const formatCurrency = (value) => {
    if (!value) return "R$ --";
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  // Função para analisar números mais frequentes em uma soma específica
  const analyzeSumNumbers = (targetSum) => {
    if (!history || history.length === 0) return null;

    const numberFrequency = {};
    let matchingDraws = 0;

    // Inicializar contagem
    for (let i = 1; i <= 60; i++) numberFrequency[i] = 0;

    // Encontrar todos os sorteios com essa soma
    history.forEach(draw => {
      const dezenas = draw.dezenas.map(d => parseInt(d, 10));
      const sum = dezenas.reduce((a, b) => a + b, 0);
      
      if (sum === targetSum) {
        matchingDraws++;
        dezenas.forEach(num => {
          if (numberFrequency[num] !== undefined) {
            numberFrequency[num]++;
          }
        });
      }
    });

    // Converter para array e ordenar por frequência
    const sortedNumbers = Object.entries(numberFrequency)
      .map(([num, freq]) => ({ num: parseInt(num), freq }))
      .filter(item => item.freq > 0)
      .sort((a, b) => b.freq - a.freq);

    return {
      sum: targetSum,
      matchingDraws,
      numbers: sortedNumbers
    };
  };

  // Handler para clicar em uma barra do gráfico
  const handleBarClick = (sum) => {
    const analysis = analyzeSumNumbers(sum);
    setSumAnalysis(analysis);
    setSelectedSum(sum);
  };

  // Função para gerar números baseados em uma soma específica
  const generateNumbersBySum = () => {
    const sumValue = parseInt(targetSum);
    if (!sumValue || sumValue < 21 || sumValue > 345) {
      alert('Por favor, insira uma soma válida entre 21 e 345');
      return;
    }

    setIsGeneratingBySum(true);
    setTimeout(() => {
      const analysis = analyzeSumNumbers(sumValue);
      
      if (!analysis || analysis.numbers.length === 0) {
        alert(`Nenhum sorteio encontrado com soma ${sumValue}. Tente outra soma.`);
        setIsGeneratingBySum(false);
        return;
      }

      // Pegar os 6 números mais frequentes
      const topNumbers = analysis.numbers
        .slice(0, 6)
        .map(item => item.num)
        .sort((a, b) => a - b);

      // Se não tiver 6 números únicos, completar com os próximos mais frequentes
      if (topNumbers.length < 6) {
        const allNumbers = analysis.numbers.map(item => item.num);
        const remaining = allNumbers.filter(n => !topNumbers.includes(n));
        topNumbers.push(...remaining.slice(0, 6 - topNumbers.length));
        topNumbers.sort((a, b) => a - b);
      }

      // Se ainda não tiver 6, completar aleatoriamente
      while (topNumbers.length < 6) {
        const randomNum = Math.floor(Math.random() * 60) + 1;
        if (!topNumbers.includes(randomNum)) {
          topNumbers.push(randomNum);
        }
      }

      setNumbers(topNumbers.slice(0, 6));
      setIsGeneratingBySum(false);
    }, 500);
  };

  // Renderização do gráfico de Histograma Real
  const renderRealHistogram = () => {
    if (!realStats) return (
      <div className="h-40 flex items-center justify-center text-slate-500 text-xs animate-pulse">
        Carregando base de dados histórica para gerar gráfico real...
      </div>
    );

    const bars = [];
    const startX = 100;
    const endX = 280;
    const maxFreq = Math.max(...Object.values(realStats.sumFrequencies));
    
    // Aumentar granularidade: passo de 3 para 1
    for (let i = startX; i <= endX; i += 1) {
      let freq = realStats.sumFrequencies[i] || 0;
      let height = freq > 0 ? (freq / maxFreq) * 100 : 2; // Mínimo de 2% para barras visíveis
      const isGoldenZone = i >= 150 && i <= 210;
      const isSelected = selectedSum === i;
      
      bars.push(
        <div 
          key={i} 
          onClick={() => handleBarClick(i)}
          className={`flex-1 rounded-t-sm transition-all duration-300 relative group cursor-pointer hover:scale-105 ${
            isSelected 
              ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.8)] z-20' 
              : isGoldenZone 
                ? 'bg-slate-600 hover:bg-slate-500' 
                : 'bg-slate-800 hover:bg-slate-700'
          }`}
          style={{ height: `${Math.max(height * 0.4, 2)}%` }} 
          title={`Clique para ver análise da soma ${i}`}
        >
           <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 bg-black text-white text-[9px] p-1 rounded z-50 whitespace-nowrap mb-1">
             Soma {i}: {freq}x
           </div>
        </div>
      );
    }
    return bars;
  };

  // Gráfico de Espectro Numérico 1-60 (Frequência Individual)
  const renderNumberSpectrum = () => {
    if (!realStats || !realStats.numberCounts) return null;

    const maxCount = Math.max(...Object.values(realStats.numberCounts));

    return (
      <div className="h-28 flex items-end justify-between gap-[2px] relative pt-6 px-2">
        {[...Array(60)].map((_, i) => {
            const num = i + 1;
            const isSelected = numbers.includes(num);
            const count = realStats.numberCounts[num];
            // Altura baseada na frequência histórica real
            const height = (count / maxCount) * 100; 
            
            return (
                <div 
                    key={num}
                    className={`flex-1 rounded-t-sm transition-all duration-500 relative group
                        ${isSelected 
                          ? 'bg-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.8)] z-10 translate-y-[-5px]' 
                          : 'bg-slate-800 hover:bg-slate-700'}
                    `}
                    style={{ height: `${height * 0.8}%`, minHeight: '10%' }}
                >
                     {/* Tooltip for number */}
                     <div className={`absolute -top-8 left-1/2 -translate-x-1/2 text-[9px] font-bold p-1 rounded bg-black z-50 whitespace-nowrap ${isSelected ? 'text-pink-400 opacity-100' : 'opacity-0 group-hover:opacity-100 text-slate-300'} transition-all`}>
                        Nº {num}: {count}x
                     </div>
                </div>
            )
        })}
        {/* Labels */}
        <div className="absolute bottom-[-15px] left-0 text-[9px] text-slate-500">01</div>
        <div className="absolute bottom-[-15px] right-0 text-[9px] text-slate-500">60</div>
        <div className="absolute bottom-[-15px] left-1/2 -translate-x-1/2 text-[9px] text-slate-500">30</div>
    </div>
    );
  };


  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <header className="max-w-6xl mx-auto mb-8 text-center md:text-left flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-black bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent uppercase tracking-tighter">
            Mega Estrategista Pro
          </h1>
          <p className="text-slate-400 text-sm flex items-center gap-2 justify-center md:justify-start">
            <Database size={12} className={history.length > 0 ? "text-emerald-400" : "text-orange-400"} />
            {loadingHistory 
              ? "Baixando histórico completo..." 
              : history.length > 0 
                ? `Análise baseada em ${history.length} concursos reais` 
                : "Modo Simulação (Dados Offline)"}
          </p>
        </div>
        <div className="flex gap-2">
          <div className="bg-slate-900 p-2 px-4 rounded-full border border-slate-800 text-xs flex items-center gap-2">
            <Activity size={12} className="text-emerald-500" />
            Estatística Descritiva Real
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Lado Esquerdo: Controles */}
        <div className="lg:col-span-4 space-y-6">
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
               <div className="flex items-center gap-2">
                  <Settings2 className="text-emerald-400" size={20} />
                  <h2 className="font-bold text-lg">Gerar ou Selecionar</h2>
               </div>
               <div className="text-xs font-bold text-slate-400 bg-slate-800 px-2 py-1 rounded-full">
                 {numbers.length}/{DRAW_COUNT} Selecionados
               </div>
            </div>
            
            <div className="space-y-4">
               {/* Modo Manual - Instrução */}
               <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50 text-xs text-slate-400 flex items-start gap-2">
                  <MousePointerClick size={16} className="text-emerald-400 mt-0.5" />
                  <span>
                    <strong>Modo Manual:</strong> Clique nos números no quadro de "Distribuição Espacial" abaixo para montar seu jogo manualmente. As estatísticas atualizarão em tempo real.
                  </span>
               </div>

               <div className="h-px bg-slate-800 my-4"></div>

               {/* Gerador por Soma Específica */}
               <div className="mb-6 p-4 bg-gradient-to-r from-purple-900/20 to-pink-900/20 rounded-lg border border-purple-500/30">
                  <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Calculator size={14} />
                    Gerador por Soma Específica
                  </h3>
                  <p className="text-[10px] text-slate-400 mb-3">
                    Digite uma soma e gere os 6 números que mais apareceram em jogos com essa soma
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="21"
                      max="345"
                      value={targetSum}
                      onChange={(e) => setTargetSum(e.target.value)}
                      placeholder="Ex: 184"
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                    />
                    <button
                      onClick={generateNumbersBySum}
                      disabled={!targetSum || isGeneratingBySum || loadingHistory}
                      className="bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold px-4 py-2 rounded-lg transition-all active:scale-95 flex items-center gap-2 disabled:cursor-not-allowed"
                    >
                      {isGeneratingBySum ? (
                        <>
                          <RotateCcw className="animate-spin" size={16} />
                          Gerando...
                        </>
                      ) : (
                        <>
                          <TrendingUp size={16} />
                          Gerar
                        </>
                      )}
                    </button>
                  </div>
                  {targetSum && (
                    <p className="text-[9px] text-slate-500 mt-2">
                      Soma desejada: <strong className="text-purple-400">{targetSum}</strong> (ideal: 150-210)
                    </p>
                  )}
               </div>

               <div className="h-px bg-slate-800 my-4"></div>

               {/* Filtros para Gerador Automático */}
               <div className="opacity-75 hover:opacity-100 transition-opacity">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Filtros do Gerador Automático</h3>
                  <label className="flex items-center justify-between p-2 mb-2 rounded cursor-pointer hover:bg-slate-800/50">
                    <span className="text-xs text-slate-300">Curva de Soma Real (150-210)</span>
                    <input type="checkbox" checked={filters.sumRange} onChange={(e) => setFilters({...filters, sumRange: e.target.checked})} className="accent-emerald-500" />
                  </label>
                  <label className="flex items-center justify-between p-2 mb-2 rounded cursor-pointer hover:bg-slate-800/50">
                    <span className="text-xs text-slate-300">Dispersão em Quadrantes</span>
                    <input type="checkbox" checked={filters.quadrants} onChange={(e) => setFilters({...filters, quadrants: e.target.checked})} className="accent-emerald-500" />
                  </label>
                  <label className="flex items-center justify-between p-2 mb-2 rounded cursor-pointer hover:bg-slate-800/50">
                    <span className="text-xs text-slate-300">Equilíbrio Par/Ímpar</span>
                    <input type="checkbox" checked={filters.parity} onChange={(e) => setFilters({...filters, parity: e.target.checked})} className="accent-emerald-500" />
                  </label>
               </div>
            </div>

            <div className="mt-8 flex gap-2">
              <button 
                onClick={clearSelection}
                disabled={numbers.length === 0}
                className="flex-1 bg-slate-800 hover:bg-red-900/50 hover:text-red-200 disabled:opacity-50 text-slate-400 font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <Trash2 size={18} />
              </button>
              <button 
                onClick={generateNumbers}
                disabled={isGenerating || loadingHistory}
                className="flex-[3] bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-black py-4 rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95 flex items-center justify-center gap-2 uppercase tracking-wider"
              >
                {isGenerating ? <RotateCcw className="animate-spin" /> : "Gerar Automático"}
              </button>
            </div>
          </section>

          {/* Resultado Rápido */}
          {numbers.length > 0 && (
            <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-2xl p-6 text-center animate-in zoom-in duration-300">
              <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest block mb-4">Sua Aposta Atual</span>
              <div className="flex flex-wrap justify-center gap-2">
                {numbers.map(n => (
                  <div 
                    key={n} 
                    onClick={() => toggleNumber(n)} // Permite remover clicando aqui também
                    className="w-12 h-12 flex items-center justify-center bg-slate-900 border-2 border-emerald-500 rounded-full font-bold text-lg text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)] cursor-pointer hover:bg-red-900/20 hover:border-red-500 hover:text-red-400 transition-colors"
                    title="Clique para remover"
                  >
                    {String(n).padStart(2, '0')}
                  </div>
                ))}
                {/* Placeholders vazios */}
                {[...Array(DRAW_COUNT - numbers.length)].map((_, i) => (
                   <div key={`empty-${i}`} className="w-12 h-12 rounded-full border border-slate-800 bg-slate-900/50 flex items-center justify-center text-slate-700 text-xl font-bold">
                     ?
                   </div>
                ))}
              </div>
            </div>
          )}

           {/* Último Sorteio Real */}
           <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
             <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Wifi size={20} className="text-emerald-400" />
                  <h3 className="font-bold text-sm">Último Sorteio na Base</h3>
                </div>
             </div>

             {latestDraw ? (
               <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex justify-between items-end mb-3">
                    <div>
                      <span className="block text-xs font-bold text-slate-200">CONCURSO {latestDraw.concurso}</span>
                      <span className="block text-[10px] text-slate-500">{latestDraw.data}</span>
                    </div>
                    {latestDraw.acumulou && (
                         <span className="text-[9px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20 font-bold">
                           ACUMULOU
                         </span>
                    )}
                  </div>
                  
                  {/* Dezenas Sorteadas */}
                  <div className="flex flex-wrap gap-1 justify-center bg-black/20 p-3 rounded-xl border border-slate-800 mb-4">
                    {latestDraw.dezenas.map(n => (
                       <span key={n} className={`w-8 h-8 flex items-center justify-center rounded-full text-xs font-bold ${numbers.includes(n) ? 'bg-emerald-500 text-slate-900 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-slate-800 text-slate-400'}`}>
                         {n}
                       </span>
                    ))}
                  </div>

                  {numbers.length > 0 && (
                    <div className="mt-3 text-center pt-2 border-t border-slate-800">
                       <span className="text-[10px] text-slate-500">Acertos comparando com este último sorteio:</span>
                       <div className="text-xl font-black text-white mt-1">
                         {latestDraw.dezenas.filter(n => numbers.includes(n)).length}
                       </div>
                    </div>
                  )}
               </div>
             ) : (
               <div className="text-center py-4 text-slate-500 text-xs italic">
                 {loadingHistory ? "Sincronizando base de dados..." : "Nenhum dado disponível."}
               </div>
             )}
          </section>
        </div>

        {/* Lado Direito: Dashboards com Dados Reais */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Top Dash: Histograma Real */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
             <div className="flex items-center justify-between mb-4">
               <div className="flex items-center gap-2">
                <BarChart3 className="text-cyan-400" size={20} />
                <h3 className="font-bold">Análise Real da "Curva de Sino" (Histórico)</h3>
              </div>
              {realStats && (
                <span className="text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-400">
                  Base: {realStats.totalDraws} concursos
                </span>
              )}
            </div>
            
            {/* O Gráfico Real */}
            <div className="h-48 flex items-end justify-between gap-[1px] relative pt-10 px-4 border-b border-slate-800">
              {renderRealHistogram()}

              {/* O Indicador de Soma Atual */}
              {currentStats && realStats && (
                <div 
                  className="absolute bottom-0 transition-all duration-1000 ease-out flex flex-col items-center z-10"
                  style={{ 
                    left: `${Math.max(0, Math.min(100, ((currentStats.sum - 100) / (280 - 100)) * 100))}%`, 
                    transform: 'translateX(-50%)'
                  }}
                >
                  <div className={`text-slate-900 text-[9px] font-black px-2 py-1 rounded shadow-lg mb-1 whitespace-nowrap ${currentStats.sum >= 150 && currentStats.sum <= 210 ? 'bg-emerald-500' : 'bg-orange-500'}`}>
                    Soma: {currentStats.sum}
                  </div>
                  <div className={`w-[2px] h-40 shadow-[0_0_10px_rgba(16,185,129,0.8)] ${currentStats.sum >= 150 && currentStats.sum <= 210 ? 'bg-emerald-500' : 'bg-orange-500'}`}></div>
                </div>
              )}
            </div>
            
            <div className="flex justify-between text-[10px] text-slate-500 mt-2 px-4">
              <span>Soma 100</span>
              <span className="text-emerald-500 font-bold">Zona de Ouro Real (150-210)</span>
              <span>Soma 280</span>
            </div>
            
            {currentStats && realStats && (
               <div className="mt-4 p-3 bg-slate-800/50 rounded-lg text-xs text-slate-300 flex items-center gap-3">
                 <TrendingUp size={16} className="text-cyan-400" />
                 <p>
                   Análise: Jogos com a soma <strong>{currentStats.sum}</strong> já ocorreram 
                   <strong className="text-white"> {currentStats.historicalFrequency} vezes</strong> na história.
                 </p>
               </div>
            )}
          </div>

          {/* Novo Dash: Espectro Numérico (Frequência 1-60) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="text-pink-400" size={20} />
              <h3 className="font-bold">Espectro de Frequência Real (1-60)</h3>
            </div>
            
            {renderNumberSpectrum()}

            <div className="mt-4 text-[10px] text-slate-400 text-center italic flex justify-center gap-4">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-pink-500"></span> Sua Aposta</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-800"></span> Frequência Histórica</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Visualizador de Matriz Interativo */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center gap-2 mb-4 justify-between">
                <div className="flex items-center gap-2">
                   <Grid3X3 className="text-purple-400" size={20} />
                   <h3 className="font-bold">Distribuição Espacial</h3>
                </div>
                <span className="text-[10px] text-emerald-400 bg-emerald-950 px-2 py-1 rounded animate-pulse">INTERATIVO</span>
              </div>
              
              <div className="grid grid-cols-10 gap-1 aspect-square md:aspect-auto">
                {[...Array(60)].map((_, i) => {
                  const num = i + 1;
                  const isSelected = numbers.includes(num);
                  const quad = getQuadrant(num);
                  const isFull = numbers.length >= DRAW_COUNT;
                  
                  return (
                    <button 
                      key={num}
                      onClick={() => toggleNumber(num)}
                      disabled={!isSelected && isFull}
                      className={`
                        text-[10px] font-medium flex items-center justify-center rounded-sm transition-all duration-200
                        ${isSelected 
                           ? 'bg-emerald-500 text-slate-900 font-bold scale-110 z-10 shadow-lg' 
                           : isFull 
                              ? 'bg-slate-800/50 text-slate-700 cursor-not-allowed' 
                              : 'bg-slate-800 text-slate-500 hover:bg-slate-700 hover:text-white cursor-pointer'}
                        ${!isSelected && quad === 1 ? 'border-l border-t border-slate-700/30' : ''}
                        ${!isSelected && quad === 2 ? 'border-r border-t border-slate-700/30' : ''}
                        ${!isSelected && quad === 3 ? 'border-l border-b border-slate-700/30' : ''}
                        ${!isSelected && quad === 4 ? 'border-r border-b border-slate-700/30' : ''}
                      `}
                      style={{ aspectRatio: '1/1' }}
                    >
                      {num}
                    </button>
                  );
                })}
              </div>
              
              <div className="mt-4 flex justify-between text-[10px]">
                <span className={`px-2 py-1 rounded ${currentStats?.activeQuadrants >= 3 ? 'text-emerald-400 bg-emerald-950 border border-emerald-900' : 'text-slate-500'}`}>
                  Quadrantes Ativos: {currentStats?.activeQuadrants || 0}/4
                </span>
                <span className="text-slate-500 italic">Ideal: 3 ou 4</span>
              </div>
            </div>

            {/* Paridade Real vs Aposta */}
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                 <div className="flex items-center gap-2 mb-4">
                  <ShieldCheck className="text-blue-400" size={20} />
                  <h3 className="font-bold">Paridade (Real vs Sua Aposta)</h3>
                </div>
                
                {/* Comparativo */}
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                      <span>Média Histórica Real</span>
                      <span>50% / 50%</span>
                    </div>
                    <div className="flex h-2 rounded-full overflow-hidden bg-slate-800">
                       <div className="bg-blue-900 w-1/2"></div>
                       <div className="bg-orange-900 w-1/2"></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] text-slate-200 mb-1">
                      <span>Sua Aposta Atual</span>
                      <span>{currentStats ? `${currentStats.evens} Par / ${currentStats.odds} Ímpar` : '--'}</span>
                    </div>
                    <div className="flex h-4 rounded-full overflow-hidden bg-slate-800">
                       <div className="bg-blue-500 transition-all duration-500" style={{ width: currentStats ? `${(currentStats.evens/6)*100}%` : '50%' }}></div>
                       <div className="bg-orange-500 transition-all duration-500" style={{ width: currentStats ? `${(currentStats.odds/6)*100}%` : '50%' }}></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status de Risco (Veredito Dinâmico) */}
              <div className={`rounded-2xl p-6 border transition-all ${verdict.bg} ${verdict.border}`}>
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg bg-black/20 ${verdict.color}`}>
                    <verdict.icon size={24} />
                  </div>
                  
                  <div>
                    <h4 className={`font-bold text-sm ${verdict.color}`}>Veredito Estatístico</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      {verdict.text}
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </main>

      <footer className="max-w-6xl mx-auto mt-12 pb-8 text-center space-y-6">
        <div className="text-slate-500 text-[10px] uppercase tracking-[0.2em] space-y-2">
          <p>A estatística não é um oráculo, é uma ferramenta de gestão de risco.</p>
          <p>© 2025 Mega Estrategista - Ciência de Dados</p>
        </div>
      </footer>

      {/* Modal de Análise de Soma */}
      {sumAnalysis && selectedSum && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => {
            setSelectedSum(null);
            setSumAnalysis(null);
          }}
        >
          <div 
            className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-black text-emerald-400 flex items-center gap-2">
                  <BarChart3 size={24} />
                  Análise da Soma {selectedSum}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Números que mais apareceram em jogos com soma {selectedSum}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedSum(null);
                  setSumAnalysis(null);
                }}
                className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-800 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mb-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <p className="text-sm text-slate-300">
                <strong className="text-emerald-400">{sumAnalysis.matchingDraws}</strong> sorteio(s) encontrado(s) com soma {selectedSum}
              </p>
            </div>

            {sumAnalysis.numbers.length > 0 ? (
              <div>
                <h4 className="text-sm font-bold text-slate-300 mb-3">Números mais frequentes (ordenados por frequência):</h4>
                <div className="grid grid-cols-6 sm:grid-cols-10 gap-2">
                  {sumAnalysis.numbers.map((item, index) => {
                    const isInCurrentBet = numbers.includes(item.num);
                    return (
                      <div
                        key={item.num}
                        className={`
                          p-2 rounded-lg border-2 text-center transition-all
                          ${isInCurrentBet
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                            : index < 10
                              ? 'bg-slate-800 border-slate-600 text-slate-300'
                              : 'bg-slate-800/50 border-slate-700 text-slate-500'
                          }
                        `}
                      >
                        <div className="text-xs font-bold">{String(item.num).padStart(2, '0')}</div>
                        <div className={`text-[10px] mt-1 ${isInCurrentBet ? 'text-emerald-300' : 'text-slate-400'}`}>
                          {item.freq}x
                        </div>
                        {isInCurrentBet && (
                          <div className="text-[8px] text-emerald-400 mt-1">✓ Seu jogo</div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <p className="text-xs text-blue-300">
                    <strong>Dica:</strong> Os números destacados em verde estão na sua aposta atual. 
                    Considere incluir os números mais frequentes que ainda não selecionou.
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <p>Nenhum número encontrado para esta soma.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;