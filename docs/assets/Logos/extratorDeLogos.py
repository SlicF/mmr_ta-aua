import os
import shutil
from pathlib import Path


def extrair_arquivos_imagens_com_numeros(diretorio_origem, diretorio_destino=None):
    """
    Extrai todos os arquivos de imagem que contenham '07', '08' ou '09' no nome.

    Args:
        diretorio_origem (str): Caminho do diretório onde procurar os arquivos
        diretorio_destino (str, opcional): Caminho onde salvar os arquivos extraídos.
                                         Se não especificado, será criada uma pasta 'arquivos_extraidos'
    """

    # Define o diretório de destino
    if diretorio_destino is None:
        diretorio_destino = os.path.join(diretorio_origem, "arquivos_extraidos")

    # Cria o diretório de destino se não existir
    Path(diretorio_destino).mkdir(parents=True, exist_ok=True)

    # Números a procurar nos nomes dos arquivos
    numeros_procurar = ["07", "08", "09"]

    # Extensões de arquivo de imagem
    extensoes_imagem = {
        ".jpg",
        ".jpeg",
        ".png",
        ".gif",
        ".bmp",
        ".tiff",
        ".tif",
        ".svg",
        ".webp",
        ".pdf",
    }

    arquivos_copiados = 0
    arquivos_encontrados = []

    print(
        f"Procurando arquivos de imagem com os números {numeros_procurar} em: {diretorio_origem}"
    )
    print("-" * 60)

    # Percorre todas as pastas e subpastas
    for root, dirs, files in os.walk(diretorio_origem):
        # Pula a pasta de destino para evitar loops
        if diretorio_destino in root:
            continue

        for arquivo in files:
            # Verifica se é um arquivo de imagem
            nome_arquivo, extensao = os.path.splitext(arquivo)
            if extensao.lower() not in extensoes_imagem:
                continue

            # Verifica se o nome do arquivo contém algum dos números procurados
            if any(numero in arquivo for numero in numeros_procurar):
                caminho_origem = os.path.join(root, arquivo)
                pasta_origem = os.path.relpath(root, diretorio_origem)

                print(f"✓ Arquivo encontrado: {arquivo}")
                print(f"  Pasta: {pasta_origem if pasta_origem != '.' else 'raiz'}")
                print(f"  Caminho completo: {caminho_origem}")

                arquivos_encontrados.append(caminho_origem)

                # Usa o nome original do arquivo
                nome_arquivo_destino = arquivo
                caminho_destino = os.path.join(diretorio_destino, nome_arquivo_destino)

                # Se já existe um arquivo com o mesmo nome, adiciona um número
                contador = 1
                while os.path.exists(caminho_destino):
                    nome_base, ext = os.path.splitext(arquivo)
                    nome_arquivo_destino = f"{nome_base}_{contador}{ext}"
                    caminho_destino = os.path.join(
                        diretorio_destino, nome_arquivo_destino
                    )
                    contador += 1

                # Copia o arquivo
                try:
                    shutil.copy2(caminho_origem, caminho_destino)
                    arquivos_copiados += 1
                    print(f"    → Copiado como: {nome_arquivo_destino}")
                except Exception as e:
                    print(f"    ✗ Erro ao copiar: {e}")

                print()  # Linha em branco para separar os arquivos

    print("-" * 60)
    print(f"Resumo:")
    print(f"  Arquivos de imagem encontrados: {len(arquivos_encontrados)}")
    print(f"  Arquivos copiados com sucesso: {arquivos_copiados}")
    print(f"  Destino: {diretorio_destino}")

    if len(arquivos_encontrados) == 0:
        print(
            f"  ⚠️  Nenhum arquivo de imagem encontrado com os números {numeros_procurar}"
        )
        print(f"  📝 Extensões procuradas: {', '.join(sorted(extensoes_imagem))}")

    return arquivos_encontrados, arquivos_copiados


def main():
    """
    Função principal que executa a extração.
    """
    # Diretório atual (onde está o script)
    diretorio_atual = os.path.dirname(os.path.abspath(__file__))

    print("=== EXTRATOR DE LOGOS ===")
    print(
        "Este programa extrai arquivos de imagem que contenham '07', '08' ou '09' no nome.\n"
    )

    # Pergunta ao usuário se quer usar o diretório atual ou especificar outro
    usar_atual = (
        input(f"Usar o diretório atual ({diretorio_atual})? (s/n): ").lower().strip()
    )

    if usar_atual == "s" or usar_atual == "":
        diretorio_origem = diretorio_atual
    else:
        diretorio_origem = input("Digite o caminho do diretório de origem: ").strip()
        if not os.path.exists(diretorio_origem):
            print(f"❌ Erro: O diretório '{diretorio_origem}' não existe!")
            return

    # Pergunta sobre o diretório de destino
    usar_destino_padrao = (
        input("Usar diretório de destino padrão (arquivos_extraidos)? (s/n): ")
        .lower()
        .strip()
    )

    if usar_destino_padrao == "s" or usar_destino_padrao == "":
        diretorio_destino = None
    else:
        diretorio_destino = input("Digite o caminho do diretório de destino: ").strip()

    # Executa a extração
    try:
        arquivos_encontrados, arquivos_copiados = extrair_arquivos_imagens_com_numeros(
            diretorio_origem, diretorio_destino
        )

        if arquivos_copiados > 0:
            print("\n✅ Extração concluída com sucesso!")
        else:
            print("\n⚠️  Nenhum arquivo foi extraído.")

    except Exception as e:
        print(f"\n❌ Erro durante a execução: {e}")


if __name__ == "__main__":
    main()
