# -*- coding: utf-8 -*-
"""
Pipeline Completo de Calibração e Validação

EXECUTA:
========
1. Calibração: Aprende parâmetros de dados históricos
2. Previsão: Gera forecasts com parâmetros fixos (baseline)
3. Validação: Compara fixo vs calibrado usando backtest
4. Relatório: Gera comparação visual das melhorias

USO:
====
    python run_calibration_pipeline.py
    python run_calibration_pipeline.py --modalidade "FUTSAL MASCULINO"
    python run_calibration_pipeline.py --skip-calibration  # usar calibração existente
"""

import argparse
import subprocess
import sys
from pathlib import Path
import json
import time

REPO_ROOT = Path(__file__).resolve().parents[1]


def run_command(cmd: list, description: str, optional: bool = False) -> bool:
    """
    Executa comando e reporta status.

    Args:
        cmd: Lista com comando e argumentos
        description: Descrição da operação
        optional: Se True, não abortar em caso de erro

    Returns:
        True se sucesso, False se erro
    """
    print(f"\n{'='*70}")
    print(f"▶  {description}")
    print(f"{'='*70}")
    print(f"   Comando: {' '.join(cmd)}")
    print()

    try:
        result = subprocess.run(
            cmd, cwd=REPO_ROOT / "src", check=True, capture_output=False, text=True
        )
        print(f"\n✅ {description} - CONCLUÍDO")
        return True

    except subprocess.CalledProcessError as e:
        print(f"\n❌ {description} - ERRO (exit code {e.returncode})")
        if not optional:
            print("\n⚠️  Pipeline interrompido devido a erro crítico")
            sys.exit(1)
        return False

    except Exception as e:
        print(f"\n❌ {description} - EXCEÇÃO: {e}")
        if not optional:
            sys.exit(1)
        return False


def check_calibration_output() -> bool:
    """Verifica se ficheiros de calibração existem."""
    calibration_dir = REPO_ROOT / "docs" / "output" / "calibration"
    required_files = [
        calibration_dir / "calibrated_params_full.json",
        calibration_dir / "calibrated_simulator_config.json",
    ]

    all_exist = all(f.exists() for f in required_files)

    if all_exist:
        print("\n✓ Ficheiros de calibração encontrados:")
        for f in required_files:
            print(f"   • {f.relative_to(REPO_ROOT)}")
    else:
        print("\n✗ Ficheiros de calibração em falta:")
        for f in required_files:
            status = "✓" if f.exists() else "✗"
            print(f"   {status} {f.relative_to(REPO_ROOT)}")

    return all_exist


def generate_summary_report(modalidade: str = None):
    """Gera relatório resumo da pipeline."""
    print(f"\n{'='*70}")
    print("📊 RELATÓRIO FINAL DA PIPELINE")
    print(f"{'='*70}")

    calibration_dir = REPO_ROOT / "docs" / "output" / "calibration"

    # 1. Status calibração
    print("\n[1] STATUS DA CALIBRAÇÃO")
    print("─" * 70)
    if check_calibration_output():
        config_file = calibration_dir / "calibrated_simulator_config.json"
        try:
            with open(config_file, "r", encoding="utf-8") as f:
                config = json.load(f)

            print(f"   Modalidades calibradas: {len(config)}")
            for mod in sorted(config.keys()):
                params = config[mod]
                print(f"   • {mod}:")
                print(
                    f"       base_goals={params.get('base_goals', 'N/A'):.2f}, "
                    f"dispersion_k={params.get('dispersion_k', 'N/A'):.2f}, "
                    f"draw_rate={params.get('base_draw_rate', 'N/A'):.1%}"
                )
        except Exception as e:
            print(f"   ⚠️  Erro ao ler config: {e}")
    else:
        print("   ❌ Calibração não concluída")

    # 2. Status backtest
    print("\n[2] STATUS DO BACKTEST")
    print("─" * 70)
    backtest_dir = REPO_ROOT / "docs" / "output" / "elo_ratings"
    backtest_files = list(backtest_dir.glob("backtest_summary_*.json"))

    if backtest_files:
        print(f"   Backtests disponíveis: {len(backtest_files)}")
        for bf in sorted(backtest_files):
            try:
                with open(bf, "r", encoding="utf-8") as f:
                    summary = json.load(f)
                mod = summary.get("modalidade", "?")
                brier = summary.get("avg_brier_score", 0)
                rmse = summary.get("avg_rmse_place", 0)
                print(f"   • {mod}: Brier={brier:.4f}, RMSE Place={rmse:.2f}")
            except Exception:
                continue
    else:
        print("   ⚠️  Nenhum backtest executado ainda")

    # 3. Status comparação
    print("\n[3] STATUS DA COMPARAÇÃO (FIXO vs CALIBRADO)")
    print("─" * 70)
    comparison_files = list(calibration_dir.glob("comparison_*.json"))

    if comparison_files:
        print(f"   Comparações disponíveis: {len(comparison_files)}")
        for cf in sorted(comparison_files):
            print(f"   • {cf.name}")
            try:
                with open(cf, "r", encoding="utf-8") as f:
                    comp = json.load(f)
                status = comp.get("status", "unknown")
                print(f"       Status: {status}")
                if "fixed_model" in comp and "results" in comp["fixed_model"]:
                    res = comp["fixed_model"]["results"]
                    print(f"       Modelo Fixo: Brier={res.get('brier_score', 'N/A')}")
            except Exception as e:
                print(f"       ⚠️  Erro ao ler: {e}")
    else:
        print("   ⚠️  Nenhuma comparação executada ainda")
        print("   💡 Para ativar comparação completa:")
        print("      1. Integrar calibrated_params no preditor.py")
        print(
            '      2. Re-executar: python backtest_validation.py --compare-calibrated --modalidade "..."'
        )

    # 4. Próximos passos
    print(f"\n{'='*70}")
    print("🎯 PRÓXIMOS PASSOS")
    print(f"{'='*70}")
    print("\n1. INTEGRAR PARÂMETROS CALIBRADOS NO PREDITOR:")
    print("   • Modificar SportScoreSimulator.__init__() para aceitar custom_params")
    print("   • Adicionar flag --use-calibrated no preditor.py")
    print("   • Carregar params do calibrated_simulator_config.json")

    print("\n2. RE-EXECUTAR COMPARAÇÃO:")
    print(
        '   python backtest_validation.py --compare-calibrated --modalidade "FUTSAL MASCULINO"'
    )

    print("\n3. ITERAR E MELHORAR:")
    print("   • Analisar métricas de melhoria")
    print("   • Ajustar calibração se necessário")
    print("   • Validar em produção")

    print(f"\n{'='*70}")


def main():
    parser = argparse.ArgumentParser(
        description="Pipeline completo de calibração e validação"
    )
    parser.add_argument(
        "--modalidade",
        type=str,
        help="Modalidade específica (ex.: 'FUTSAL MASCULINO'). Se omitida, processa todas.",
    )
    parser.add_argument(
        "--skip-calibration",
        action="store_true",
        help="Pular etapa de calibração (usar calibração existente)",
    )
    parser.add_argument(
        "--skip-backtest",
        action="store_true",
        help="Pular backtest (apenas calibrar)",
    )
    parser.add_argument(
        "--season",
        type=str,
        help="Época específica para comparação (ex.: '24_25')",
    )
    args = parser.parse_args()

    print("=" * 70)
    print("🚀 PIPELINE DE CALIBRAÇÃO E VALIDAÇÃO")
    print("=" * 70)
    print(f"Modalidade: {args.modalidade or 'TODAS'}")
    print(f"Época: {args.season or 'Mais recente'}")
    print("=" * 70)

    start_time = time.time()

    # STEP 1: CALIBRAÇÃO
    if not args.skip_calibration:
        run_command(
            ["python", "calibrator.py"],
            "STEP 1: Calibração de parâmetros",
            optional=False,
        )
    else:
        print("\n⏭️  PULANDO calibração (usando ficheiros existentes)")
        if not check_calibration_output():
            print("❌ Ficheiros de calibração não encontrados!")
            print("   Remover --skip-calibration ou executar calibrator.py primeiro")
            sys.exit(1)

    # STEP 2: BACKTEST
    if not args.skip_backtest:
        backtest_cmd = ["python", "backtest_validation.py"]
        if args.modalidade:
            backtest_cmd.extend(["--modalidade", args.modalidade])

        run_command(
            backtest_cmd,
            "STEP 2: Backtest com modelo fixo (baseline)",
            optional=True,  # Não crítico se falhar
        )
    else:
        print("\n⏭️  PULANDO backtest")

    # STEP 3: COMPARAÇÃO (se modalidade específica)
    if args.modalidade and not args.skip_backtest:
        comparison_cmd = [
            "python",
            "backtest_validation.py",
            "--compare-calibrated",
            "--modalidade",
            args.modalidade,
        ]
        if args.season:
            comparison_cmd.extend(["--season", args.season])

        run_command(
            comparison_cmd,
            "STEP 3: Comparação fixo vs calibrado",
            optional=True,  # Ainda não totalmente implementado
        )

    # STEP 4: RELATÓRIO FINAL
    generate_summary_report(args.modalidade)

    elapsed = time.time() - start_time
    print(f"\n⏱️  Tempo total: {elapsed:.1f}s")
    print("=" * 70)


if __name__ == "__main__":
    main()
