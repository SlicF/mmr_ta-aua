# OPERATIONS_GUIDE.md - Procedimentos

## Pipeline (Ordem Obrigatória)
1. python extrator.py (30s)
2. python mmr_taçaua.py (2-3 min, apaga previsões!)
3. python calibrator.py (1 min)
4. python preditor.py [--deep-simulation] (30s-45min)

## Troubleshooting
- Pré visões vazias? Verificar mmr_taçaua.py rodou, calibrator.py completou
- Classificações erradas? Check K-factor, PointsCalculator
- Sem empates? <5 empates observados = modelo REJECTED, usa Gaussiana
- ProcessPool congelado? Adicionar 'if __name__=="__main__":'

## Adicionar Modalidade
1. Adicionar aba Excel
2. Adicionar em SportDetector.detect_sport()
3. Adicionar PointsCalculator rule
4. Adicionar cor em config_cursos.json
5. Rodar pipeline completo

## GitHub Actions
Daily @ 01:00 UTC - executa pipeline e atualiza website
