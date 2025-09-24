#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para extrair apenas a cor primária (dominante) dos emblemas
"""

import os
from PIL import Image
from collections import Counter
import colorsys


def rgb_to_hex(r, g, b):
    """Converte RGB para hex"""
    return f"#{r:02x}{g:02x}{b:02x}"


def get_primary_color(image_path):
    """Extrai a cor mais dominante de uma imagem (excluindo branco)"""
    try:
        with Image.open(image_path) as img:
            # Converter para RGB se necessário
            if img.mode != "RGB":
                img = img.convert("RGB")

            # Reduzir o tamanho para acelerar o processamento
            img.thumbnail((100, 100))

            # Obter todas as cores dos pixels
            pixels = list(img.getdata())

            # Filtrar pixels muito claros (branco e quase-branco)
            filtered_pixels = []
            for r, g, b in pixels:
                # Calcular brilho
                brightness = (r + g + b) / 3
                # Filtrar brancos, cinzas muito claros
                if brightness < 240 and not (r > 250 and g > 250 and b > 250):
                    # Também filtrar cores muito dessaturadas (cinzas)
                    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
                    if (
                        s > 0.1 or v < 0.8
                    ):  # Manter cores com alguma saturação ou não muito brilhantes
                        filtered_pixels.append((r, g, b))

            if not filtered_pixels:
                return "#2c3e50"  # Cor padrão se não encontrar cores válidas

            # Contar ocorrências de cada cor
            color_count = Counter(filtered_pixels)

            # Encontrar a cor mais frequente
            most_common_color = color_count.most_common(1)[0][0]

            # Converter para hex
            return rgb_to_hex(*most_common_color)

    except Exception as e:
        print(f"Erro ao processar {image_path}: {e}")
        return "#2c3e50"


def main():
    print("=== EXTRAÇÃO DE CORES PRIMÁRIAS ===")

    # Mapeamento curso -> núcleo -> emblema
    course_nucleus_mapping = {
        "AP": ("NEAP", "assets/Logos/NEAP-07.png"),
        "Biologia": ("NEB", "assets/Logos/NEB-07.png"),
        "Biologia e Geologia": ("NEBG", "assets/Logos/NEBG-07.png"),
        "Bioquímica": ("NEQ", "assets/Logos/NEQ-07.png"),
        "Biotecnologia": ("NECiB", "assets/Logos/NECiB-07.png"),
        "CBM": ("NECiB", "assets/Logos/NECiB-07.png"),
        "Ciências do Mar": ("NECM", "assets/Logos/NECM-07.png"),
        "Contabilidade": ("NAE-ISCA", "assets/Logos/NAE_ISCA-07.png"),
        "DPT": ("NAE-ESAN", "assets/Logos/NAE_ESAN-07.png"),
        "Design": ("NED", "assets/Logos/NED-07.png"),
        "ECT": ("NEECT", "assets/Logos/NEECT-07.png"),
        "EET": ("NEEETA", "assets/Logos/NEEETA-07.png"),
        "EGI": ("AEGIA", "assets/Logos/EGI-07.png"),  # Especial
        "Economia": ("NEEC", "assets/Logos/NEEC-07.png"),
        "Educação Básica": ("NEEB", "assets/Logos/NEEB-07.png"),
        "Enfermagem": ("NAE-ESSUA", "assets/Logos/NAE_ESSUA-07.png"),
        "Eng. Aeroespacial": ("NEEMec", "assets/Logos/NEEMec-07.png"),
        "Eng. Ambiente": ("NEEA", "assets/Logos/NEEA-07.png"),
        "Eng. Biomédica": ("NEEF", "assets/Logos/NEEF-07.png"),
        "Eng. Civil": ("NEBEC", "assets/Logos/NEBEC-07.png"),
        "Eng. Computacional": ("NEEF", "assets/Logos/NEEF-07.png"),
        "Eng. Física": ("NEEF", "assets/Logos/NEEF-07.png"),
        "Eng. Informática": ("NEI", "assets/Logos/NEI-07.png"),
        "Eng. Materiais": ("NEM", "assets/Logos/NEM-07.png"),
        "Eng. Mecânica": ("NEEMec", "assets/Logos/NEEMec-07.png"),
        "Eng. Química": ("NEEQu", "assets/Logos/NEEQu-07.png"),
        "Finanças": ("NAE-ISCA", "assets/Logos/NAE_ISCA-07.png"),
        "Fisioterapia": ("NAE-ESSUA", "assets/Logos/NAE_ESSUA-07.png"),
        "Física": ("NEEF", "assets/Logos/NEEF-07.png"),
        "GPT": ("NEGPT", "assets/Logos/NEGPT-07.png"),
        "Geologia": ("NEGeo", "assets/Logos/NEGeo-07.png"),
        "Gestão": ("NEG", "assets/Logos/NEG-07.png"),
        "LLC": ("NELLC", "assets/Logos/NELLC-07.png"),
        "LRE": ("NELRE", "assets/Logos/NELRE-07.png"),
        "MTC": ("NEMTC", "assets/Logos/NEMTC-07.png"),
        "Matemática": ("NEMAT", "assets/Logos/NEMAT-07.png"),
        "Música": ("NEMu", "assets/Logos/NEMu-07.png"),
        "Psicologia": ("NEP", "assets/Logos/NEP-07.png"),
        "Química": ("NEQ", "assets/Logos/NEQ-07.png"),
        "TI": ("NEECT", "assets/Logos/NEECT-07.png"),
        "Tradução": ("NET", "assets/Logos/NET-07.png"),
    }

    # Extrair cores por núcleo (evitar duplicação)
    nucleus_colors = {}

    print("Analisando emblemas por núcleo:")
    for course, (nucleus, emblem_path) in course_nucleus_mapping.items():
        if nucleus not in nucleus_colors:
            if os.path.exists(emblem_path):
                primary_color = get_primary_color(emblem_path)
                nucleus_colors[nucleus] = primary_color
                print(f"  {nucleus}: {primary_color} ({emblem_path})")
            else:
                nucleus_colors[nucleus] = "#2c3e50"
                print(f"  {nucleus}: #2c3e50 (FALTA: {emblem_path})")

    print(f"\n=== CORES POR NÚCLEO ===")
    for nucleus, color in sorted(nucleus_colors.items()):
        print(f"{nucleus}: {color}")

    # Gerar configuração JavaScript atualizada apenas com cores primárias
    print(f"\n=== CONFIGURAÇÃO JAVASCRIPT ===")
    print("// Cores primárias corrigidas:")
    for course, (nucleus, emblem_path) in sorted(course_nucleus_mapping.items()):
        primary_color = nucleus_colors[nucleus]
        secondary_color = "#6c757d"  # Cinza neutro para todas as secundárias
        print(
            f"'{course}': {{ primaryColor: '{primary_color}', secondaryColor: '{secondary_color}' }},"
        )


if __name__ == "__main__":
    main()
