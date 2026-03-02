# SPECIAL_CASES.md - Casos Edge

## Transições de Equipas
Contabilidade → Marketing Andebol (25-26)
ELO histórico transferido, sem reset

## Formatos Playoff
E1/E2=K×1.5, E3L=K×0.75, MP1/LP1=K×1.5

## Ausências
Removidas da calibração (~4.5% dos jogos)
Não afetam ELO de nenhuma equipa

## Normalização Nomes
4-pass: remove espaços → remove acentos → verifica config → fallback mapping

## Detecção Desporto
Priority: andebol > futsal > futebol > basquete > volei, default=futsal

## K-factor Casos Especiais
- Início: K elevado (>150) para ajustes rápidos
- Pós-inverno: K elevado para re-calibração
- E3L: K=75 (divisão menor)

## Placeholders
TBD, TBC, W1, W2, L1, L2 - skip jogo até confirmação
