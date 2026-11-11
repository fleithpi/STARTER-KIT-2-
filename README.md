# Vitrine de Descarte & Ecopontos — Flask + SQLite

## Requisitos
- Python 3.10 ou superior
- pip

## Instalação

No terminal, dentro da pasta do projeto:

```bash
python -m venv .venv
```

Ative o ambiente virtual:

**Windows**
```bash
.venv\Scripts\activate
```

**Linux / macOS**
```bash
source .venv/bin/activate
```

Instale as dependências e inicie:

```bash
pip install -r requirements.txt
python app.py
```

Acesse `http://127.0.0.1:5000`.

## Banco de dados
O SQLite é criado automaticamente em `instance/ecopontos.db` na primeira execução. Os quatro ecopontos originais são inseridos somente quando a tabela está vazia. Reiniciar o servidor não apaga os dados.

Para fazer backup, copie o arquivo `instance/ecopontos.db` com o servidor parado.

## Funcionalidades
- Listar e filtrar ecopontos.
- Cadastrar, editar e excluir ecopontos.
- Validação dos campos no servidor.
- Consultas SQL parametrizadas.
- Interface acessível e responsiva.
- API JSON em `/api/ecopontos`.

## Endpoints
- `GET /api/ecopontos` — listar.
- `POST /api/ecopontos` — cadastrar.
- `PUT /api/ecopontos/<id>` — editar.
- `DELETE /api/ecopontos/<id>` — excluir.

## Atenção antes de publicar na internet
Esta versão é uma base funcional para uso local/desenvolvimento e **não possui autenticação**. Qualquer pessoa que consiga acessar a aplicação poderá cadastrar, editar ou excluir ecopontos. Antes de disponibilizar publicamente, implemente login e autorização (por exemplo, apenas administradores podem alterar dados), proteção CSRF quando aplicável, HTTPS e um servidor WSGI de produção. Não use `debug=True` em produção.

Os endereços, horários e links dos quatro registros iniciais foram mantidos dos arquivos fornecidos e precisam ser confirmados com os responsáveis pelos pontos de coleta.
