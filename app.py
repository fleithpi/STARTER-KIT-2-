from __future__ import annotations

import os
import re
import sqlite3
from pathlib import Path
from urllib.parse import urlparse

from flask import Flask, jsonify, render_template, request, g

BASE_DIR = Path(__file__).resolve().parent
DATABASE_PATH = Path(os.environ.get("DATABASE_PATH", BASE_DIR / "instance" / "ecopontos.db"))

app = Flask(__name__)
app.config["JSON_AS_ASCII"] = False
app.config["MAX_CONTENT_LENGTH"] = 1 * 1024 * 1024

CATEGORIAS = {"Reciclaveis", "Vidro", "Eletronicos", "Oleo"}
CAMPOS_OBRIGATORIOS = ("nome", "bairro", "categoria", "horario", "endereco", "mapaUrl")
ICONES_PADRAO = {
    "Reciclaveis": "fa-recycle",
    "Vidro": "fa-wine-bottle",
    "Eletronicos": "fa-plug",
    "Oleo": "fa-bottle-droplet",
}

DADOS_INICIAIS = [
    (1, "Ecoponto Central — Sec. de Meio Ambiente", "Centro", "Eletronicos",
     "Segunda a sexta, 08h às 17h", "Rua Praça Gov. Ivo Silveira, Centro",
     "https://maps.google.com/?q=Garopaba+Centro", "fa-plug"),
    (2, "Ponto Verde IFSC Câmpus Garopaba", "Campo D'Una", "Reciclaveis",
     "Segunda a sexta, 08h às 22h", "Rua Maria Rosa, Campo D'Una",
     "https://maps.google.com/?q=IFSC+Garopaba", "fa-recycle"),
    (3, "Coleta de Vidro e Óleo — Associação Comunitária", "Ferrugem", "Vidro",
     "Sábados, 09h às 13h", "Estrada Geral da Ferrugem",
     "https://maps.app.goo.gl/r5PxGL6jaeWf9rwJ7", "fa-wine-bottle"),
    (4, "PEV Óleo Vegetal — Praia do Silveira", "Silveira", "Oleo",
     "Segunda a sábado, 08h às 18h", "Acesso Principal à Praia do Silveira",
     "https://maps.google.com/?q=Praia+do+Silveira+Garopaba", "fa-bottle-droplet"),
]


def obter_conexao() -> sqlite3.Connection:
    """Retorna uma conexão SQLite associada à requisição atual."""
    if "db" not in g:
        DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
        g.db = sqlite3.connect(DATABASE_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


@app.teardown_appcontext
def fechar_conexao(_erro=None) -> None:
    conexao = g.pop("db", None)
    if conexao is not None:
        conexao.close()


def inicializar_banco() -> None:
    """Cria a tabela e popula os dados iniciais apenas quando estiver vazia."""
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DATABASE_PATH) as conexao:
        conexao.execute("""
            CREATE TABLE IF NOT EXISTS ecopontos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT NOT NULL,
                bairro TEXT NOT NULL,
                categoria TEXT NOT NULL,
                horario TEXT NOT NULL,
                endereco TEXT NOT NULL,
                mapa_url TEXT NOT NULL,
                icone TEXT NOT NULL,
                criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)
        quantidade = conexao.execute(
            "SELECT COUNT(*) FROM ecopontos"
        ).fetchone()[0]
        if quantidade == 0:
            conexao.executemany("""
                INSERT INTO ecopontos
                (id, nome, bairro, categoria, horario, endereco, mapa_url, icone)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, DADOS_INICIAIS)


def validar_dados(dados: object) -> tuple[dict | None, str | None]:
    if not isinstance(dados, dict):
        return None, "Envie os dados em formato JSON."

    valores = {}
    for campo in CAMPOS_OBRIGATORIOS:
        valor = dados.get(campo)
        if not isinstance(valor, str) or not valor.strip():
            return None, f'O campo "{campo}" é obrigatório.'
        valor = valor.strip()
        if len(valor) > 500:
            return None, f'O campo "{campo}" excede o limite de 500 caracteres.'
        valores[campo] = valor

    if valores["categoria"] not in CATEGORIAS:
        return None, "Categoria inválida."

    parsed_url = urlparse(valores["mapaUrl"])
    if parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc:
        return None, "Informe um endereço de mapa válido começando com http:// ou https://."

    valores["icone"] = ICONES_PADRAO[valores["categoria"]]
    return valores, None


@app.get("/")
def pagina_inicial():
    return render_template("index.html")


@app.get("/api/ecopontos")
def listar_ecopontos():
    linhas = obter_conexao().execute("""
        SELECT id, nome, bairro, categoria, horario, endereco,
               mapa_url AS mapaUrl, icone
        FROM ecopontos
        ORDER BY nome COLLATE NOCASE
    """).fetchall()
    return jsonify([dict(linha) for linha in linhas])


@app.post("/api/ecopontos")
def criar_ecoponto():
    dados, erro = validar_dados(request.get_json(silent=True))
    if erro:
        return jsonify({"erro": erro}), 400

    conexao = obter_conexao()
    cursor = conexao.execute("""
        INSERT INTO ecopontos (nome, bairro, categoria, horario, endereco, mapa_url, icone)
        VALUES (:nome, :bairro, :categoria, :horario, :endereco, :mapaUrl, :icone)
    """, dados)
    conexao.commit()
    return jsonify({"id": cursor.lastrowid, "mensagem": "Ecoponto cadastrado com sucesso."}), 201


@app.put("/api/ecopontos/<int:ecoponto_id>")
def atualizar_ecoponto(ecoponto_id: int):
    dados, erro = validar_dados(request.get_json(silent=True))
    if erro:
        return jsonify({"erro": erro}), 400

    conexao = obter_conexao()
    cursor = conexao.execute("""
        UPDATE ecopontos
        SET nome = :nome,
            bairro = :bairro,
            categoria = :categoria,
            horario = :horario,
            endereco = :endereco,
            mapa_url = :mapaUrl,
            icone = :icone,
            atualizado_em = CURRENT_TIMESTAMP
        WHERE id = :id
    """, {**dados, "id": ecoponto_id})
    conexao.commit()

    if cursor.rowcount == 0:
        return jsonify({"erro": "Ecoponto não encontrado."}), 404
    return jsonify({"mensagem": "Ecoponto atualizado com sucesso."})


@app.delete("/api/ecopontos/<int:ecoponto_id>")
def excluir_ecoponto(ecoponto_id: int):
    conexao = obter_conexao()
    cursor = conexao.execute(
        "DELETE FROM ecopontos WHERE id = ?", (ecoponto_id,)
    )
    conexao.commit()

    if cursor.rowcount == 0:
        return jsonify({"erro": "Ecoponto não encontrado."}), 404
    return jsonify({"mensagem": "Ecoponto excluído com sucesso."})


@app.errorhandler(413)
def arquivo_muito_grande(_erro):
    return jsonify({"erro": "A solicitação excedeu o tamanho permitido."}), 413


if __name__ == "__main__":
    inicializar_banco()
    # debug=False evita expor o depurador. Para desenvolvimento, altere via variável de ambiente.
    app.run(
        host=os.environ.get("FLASK_HOST", "127.0.0.1"),
        port=int(os.environ.get("FLASK_PORT", "5000")),
        debug=os.environ.get("FLASK_DEBUG", "0") == "1",
    )
