const express = require("express");
const app = express();
const mysql = require("mysql");
const cors = require("cors");
const Blob = require('node-blob');

const db = mysql.createPool({
	host: "br536.hostgator.com.br",
	user: "por87206_nicolasbenitiz",
	password: ">8|0Lr)u2>e8wE#R.bM+0dtMrh48|7b&-3bgDR}",
	database: "por87206_banco1" 
});

app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb'}));

app.use(cors());
app.use(express.json());

app.get('/musicas-missa', (req, res) => {
	let sql = ` SELECT tb_musicas.id, tb_musicas.nome, tb_musicas.autor, tb_musicas.parteMissaList, tb_musicas.url, tb_musicas.lingua
				FROM tb_missas
				INNER JOIN tb_musicas_missas ON tb_missas.id = tb_musicas_missas.id_missa
				INNER JOIN tb_musicas ON tb_musicas.id = tb_musicas_missas.id_musica
				WHERE tb_missas.url = ?
				ORDER BY nome`;

	db.query(sql, req.query.url, (err, result) => {
		if (err) console.log(err);
		else {
			const agrupado = {};
			result.map((obj) => {
			    obj["parteMissaList"].split(",").map(partes => {

				    if (!agrupado[partes]) {
				        agrupado[partes] = [];
				    }
				    agrupado[partes].push(obj);
			   })
			   
			}, {});

			for (let j = 1; j <= 16; j++ ) {
			    if (j in agrupado == false) {
			    	agrupado[j] = [];
			    }
			}

			res.send(agrupado);
		}
	})
});

app.get('/dados-musica', (req, res) => {
	let sql = ` SELECT nome, autor, cifra, id,
				CASE
			 		WHEN url_youtube IS NULL OR url_youtube = '' THEN 'false'
			        ELSE url_youtube
		        END AS url_youtube, 
			 	CASE
			 		WHEN link_partitura IS NULL OR link_partitura = '' THEN 'false'
			        ELSE link_partitura
		        END AS link_partitura
				FROM tb_musicas
				WHERE url = ?;`; 

	db.query(sql, req.query.url, (err, result) => {
		if (err) console.log(err);
		else {

			var tempResp = result[0];

			if (tempResp["url_youtube"] != "false") {
				var url = tempResp["url_youtube"];
				url = url.split("/");
				url = url[url.length-1];

				const match = url.match(/watch\?v=(.*)/);

				tempResp["url_youtube"] = match[1];
			}

			res.send(tempResp);
		}
	})
});

app.get('/get-missas', (req, res) => {
	let sql = 	`	SELECT * FROM tb_missas;`

	db.query(sql, (err, result) => {
		if (err) console.log(err);
		else {
			var tempDict = {};
			for (let i = 0; i < result.length; i++) {
				tempDict[result[i].url] = result[i].nome;
			}

			res.send(tempDict);
		}
	})
});

app.get('/get-data-missas', (req, res) => {
	let sql = 	`SELECT 
					tb_calendario.id, 
					tb_missas.id as id_missa, 
					tb_missas.nome, 
					tb_calendario.data 
				FROM tb_calendario
				LEFT JOIN tb_missas ON tb_missas.id = tb_calendario.id_missa
				ORDER BY tb_calendario.data DESC;`

	db.query(sql, (err, result) => {
		if (err) console.log(err);
		else {
			res.send(result);
		}
	})
});

app.get('/oracoes-por-tipo-oracao', (req, res) => {

	let sql = 	` SELECT id, nome_oracao, CONCAT("/oracoes/", url) as url, nome_tipo_oracao
				  FROM tb_oracoes
			   	  INNER JOIN (
				    SELECT nome_tipo_oracao, id_tipo_oracao
				    FROM tb_tipos_oracoes
				    WHERE url = ?) AS tb_infos_tipo_oracao
				    ON tb_infos_tipo_oracao.id_tipo_oracao = tb_oracoes.id_tipo_oracao
				    ORDER BY nome_oracao;`;

	db.query(sql, req.query.url, (err, result) => {
		if (err) console.log(err);
		else {
			var tempDict = {};
			tempDict["nome_tipo_oracao"] = result[0]["nome_tipo_oracao"];
			tempDict["dados"] = result;
			res.send(tempDict);
		}
	})
});

app.get('/get-solenidades-e-festas', (req, res) => {
	let sql = 	`   SELECT * FROM (SELECT nome, url, 
					CASE
						WHEN ehSolenidade = 1 THEN "Solenidade"
					    ELSE "Ocasião Especial"
					END AS origem
					FROM tb_missas
					WHERE ehSolenidade = 1 OR ehOcasiaoEspecial = 1) as tabelinha
                    ORDER BY nome;`

	db.query(sql, (err, result) => {
		if (err) console.log(err);
		else {
			var tempDict = {"Solenidade": {}, "Ocasião Especial": {}};
			for (let i = 0; i < result.length; i++) {
				if (result[i].origem == "Solenidade") {
					tempDict["Solenidade"][result[i].nome] = "/musica-liturgica/missa/" + result[i].url;
				} else {
					tempDict["Ocasião Especial"][result[i].nome] = "/musica-liturgica/tema/" + result[i].url;
				}
			}
			res.send(tempDict);
		}
	})
});

app.get('/get-tempos-liturgicos', (req, res) => {
	let sql = 	`   SELECT id, nome, CONCAT("/musica-liturgica/missa/", url) as url, 
					CASE 
						WHEN tb_missas.url LIKE '%tempo-comum%' THEN 'tempo-comum' 
						WHEN tb_missas.url LIKE '%pascoa%' THEN 'pascoa' 
						WHEN tb_missas.url LIKE '%quaresma%' THEN 'quaresma' 
						WHEN tb_missas.url LIKE '%advento%' THEN 'advento' 
						WHEN nome = 'Festa de Cristo Rei' THEN 'tempo-comum' 
						WHEN ehSolenidade = 1 OR ehOcasiaoEspecial = 1 THEN 'todos-os-tempos'
					END AS tempo_liturgico 
					FROM tb_missas 
					ORDER BY id ASC;`

	db.query(sql, (err, result) => {
		if (err) console.log(err);
		else {
			var tempDict = {"tempo-comum": {}, "pascoa": {}, "quaresma": {}, "advento": {}, "todos-os-tempos": {}};
			for (let i = 0; i < result.length; i++) {
				tempDict[result[i].tempo_liturgico][result[i].nome] = result[i].url;
			}
			res.send(tempDict);
		}
	})
});

app.get('/get-tempos-liturgicos-with-id', (req, res) => {
	let sql = 	`   SELECT id, nome, CONCAT("/musica-liturgica/missa/", url) as url, 
					CASE 
						WHEN tb_missas.url LIKE '%tempo-comum%' THEN 'tempo-comum' 
						WHEN tb_missas.url LIKE '%pascoa%' THEN 'pascoa' 
						WHEN tb_missas.url LIKE '%quaresma%' THEN 'quaresma' 
						WHEN tb_missas.url LIKE '%advento%' THEN 'advento' 
						WHEN nome = 'Festa de Cristo Rei' THEN 'tempo-comum' 
						WHEN ehSolenidade = 1 OR ehOcasiaoEspecial = 1 THEN 'todos-os-tempos'
					END AS tempo_liturgico 
					FROM tb_missas 
					ORDER BY id ASC;`

	db.query(sql, (err, result) => {
		if (err) console.log(err);
		else {
			var tempDict = {"tempo-comum": {}, "pascoa": {}, "quaresma": {}, "advento": {}, "todos-os-tempos": {}};
			for (let i = 0; i < result.length; i++) {
				tempDict[result[i].tempo_liturgico][result[i].nome] = result[i].id;
			}
			res.send(tempDict);
		}
	})
});

app.get('/datas-liturgicas', (req, res) => {
	let sql = 	`	SELECT *
					FROM tb_calendario
					INNER JOIN tb_missas ON tb_missas.id = tb_calendario.id_missa
					WHERE tb_calendario.id = (	SELECT id
									            FROM tb_calendario
									            WHERE data >= ?
									            ORDER BY data
									            LIMIT 1);`

	db.query(sql, req.query.date, (err, result) => {
		console.log("Result is");
		console.log(result);
		if (err) console.log(err);
		else if (result[0] == null || result[0] == "") {
			res.send(null)
		}
		else {
			res.send(result[0]);
		}
	})
});

app.get('/musicas-parte-missa', (req, res) => {

	let sql = 	`SELECT *
				FROM tb_musicas
				WHERE parteMissaList LIKE ?
				ORDER BY nome`;

	db.query(sql, `%${req.query.parteMissa}%`, (err, result) => {
		if (err) console.log(err);
		else {
			const regex = new RegExp(`(?<=\,)${req.query.parteMissa}(?=\,)|(?<=\,)${req.query.parteMissa}$|^${req.query.parteMissa}(?=\,)|^${req.query.parteMissa}$`);
			const filteredData = result.filter(obj => regex.test(obj.parteMissaList));
			res.send(filteredData);
		}
	})
});

app.get('/oracoes-missa', (req, res) => {
	let sql = ` SELECT id_tipo_oracao, nome_tipo_oracao, categoria_oracao, CONCAT("/oracoes/tema/",url) as url
				FROM tb_tipos_oracoes
				ORDER BY nome_tipo_oracao`;

	db.query(sql, (err, result) => {
		if (err) console.log(err);
		else {
			const agrupado = result.reduce((acc, obj) => {
			   const { categoria_oracao, ...resto } = obj;
			    if (!acc[categoria_oracao]) {
			        acc[categoria_oracao] = [];
			    }
			    acc[categoria_oracao].push(resto);
			    return acc;
			}, {});

			res.send(agrupado);
		}
	})
});

app.get('/oracoes-possiveis-pesquisa', (req, res) => {
	let sql = ` SELECT * FROM ((SELECT nome_tipo_oracao as nome, CONCAT("/oracoes/tema/",url) as url
				FROM tb_tipos_oracoes)
					UNION
				(SELECT nome_oracao as nome, CONCAT("/oracoes/", url) as url
				FROM tb_oracoes)) as tabelinha
				ORDER BY nome;`;

	db.query(sql, (err, result) => {
		if (err) console.log(err);
		else {
			var tempDict = {};
			for (let i = 0; i < result.length; i++) {
				tempDict[result[i]["nome"]] = result[i]["url"];
			}
			res.send(tempDict);
		}
	})
});

app.get('/nome-tipo-oracao', (req, res) => {

	let sql = 	`SELECT nome_tipo_oracao
				 FROM tb_tipos_oracoes
				 WHERE url = ?`;

	db.query(sql, req.query.url, (err, result) => {
		if (err) console.log(err);
		else {
			res.send(result);
		}
	})
});

app.get('/subsidios-por-subdivisao', (req, res) => {

	let sql = 	` SELECT id, nome_documento, caminho_arquivo, nome_subdivisao_subsidio
				  FROM tb_subsidios
			   	  INNER JOIN (
				    SELECT id_subdivisao_subsidio, nome_subdivisao_subsidio
				    FROM tb_subdivisao_subsidio
				    WHERE url = ?) AS tb_infos_tipo_oracao
				    ON tb_infos_tipo_oracao.id_subdivisao_subsidio = tb_subsidios.id_subdivisao_subsidio
				    ORDER BY nome_documento;`;

	db.query(sql, req.query.url, (err, result) => {
		if (err) console.log(err);
		else {
			var tempDict = {};
			tempDict["nome_subdivisao_subsidio"] = result[0]["nome_subdivisao_subsidio"];
			tempDict["dados"] = result;
			res.send(tempDict);
		}
	})
});

app.get('/get-musicas', (req, res) => {

	const deparaDict = {
		"1":'Entrada',
	    "2":'Ato Penitencial',
	    "3":'Glória',
	    "4":'Salmo Responsorial',
	    "5":'Ofertório',
	    "6":'Santo',
	    "7":'Doxologia',
	    "8":'Cordeiro de Deus',
	    "9":'Comunhão',
	    "10":'Ladainhas',
	    "11":'Canto Final',
	    "12":'Natal',
	    "13":'Nossa Senhora',
	    "14":'Aclamação do Evangelho',
	    "15":'Batismo',
	    "16":'Casamento',
	    "17":'Crisma',
	    "18":'Ordenação Presbiteral',
	    "19":'Retiro de Casais'
	};

	let sql = 	`SELECT id, nome, autor, cifra,
					parteMissaList AS parteMissa,
					url,
					url_youtube,
					link_partitura,
					CASE
						WHEN lingua = 1 THEN 'Português'
					    WHEN lingua = 2 THEN 'Latim'
					END AS lingua,
					CASE
						WHEN tempo_liturgico = 1 THEN 'Todos os tempos'
					    WHEN tempo_liturgico = 2 THEN 'Advento'
					    WHEN tempo_liturgico = 3 THEN 'Quaresma'
					    WHEN tempo_liturgico = 4 THEN 'Páscoa'
					    WHEN tempo_liturgico = 5 THEN 'Tempo Comum'
					END AS tempo_liturgico,
                    CASE
                    	WHEN url_youtube IS NULL OR url_youtube = '' THEN false
                        ELSE true
                    END AS flag_youtube,
                    CASE
                    	WHEN link_partitura IS NULL OR link_partitura = '' THEN false
                        ELSE true
                    END AS flag_partitura
					FROM tb_musicas;`;

	db.query(sql, (err, result) => {
		if (err) console.log(err);
		else {
			var returningValue = result.map(item => {
				var values = item["parteMissa"].split(",");
				values = values.map(item => deparaDict[item]);
			    return {...item, "parteMissa": values}
			});
			res.send(returningValue);
		}
	})
});

app.get('/get-missas-datagrid', (req, res) => {

	let sql = 	`SELECT id, nome, url,
				 CASE
					 WHEN ehSolenidade = 1 THEN "Solenidade"
				     WHEN ehOcasiaoEspecial = 1 THEN "Ocasião Especial"
				     ELSE "Comum"
				 END AS tipo
				 FROM tb_missas
				 ORDER BY tipo DESC`;

	db.query(sql, (err, result) => {
		if (err) console.log(err);
		else {
			res.send(result);
		}
	})
});

app.get('/get-categorias-subsidios', (req, res) => {

	let sql = 	`SELECT 
					*
				FROM tb_subdivisao_subsidio;`;

	db.query(sql, (err, result) => {
		if (err) console.log(err);
		else {
			res.send(result);
		}
	})
});

app.get('/get-tipos-oracoes', (req, res) => {

	let sql = 	`SELECT 
					*
				FROM tb_tipos_oracoes;`;

	db.query(sql, (err, result) => {
		if (err) console.log(err);
		else {
			res.send(result);
		}
	})
});

app.get('/get-subdivisoes-subsidio', (req, res) => {

	let sql = 	`SELECT id_subdivisao_subsidio, CONCAT(tb_subdivisao_subsidio.categoria_subdivisao, " - ", tb_subdivisao_subsidio.nome_subdivisao_subsidio) as nome_subdivisao_subsidio, categoria_subdivisao, url, id_tipo_subsidio
				 FROM tb_subdivisao_subsidio;`;

	db.query(sql, (err, result) => {
		if (err) console.log(err);
		else {
			const agrupado = result.reduce((acc, obj) => {
			   const { id_tipo_subsidio, ...resto } = obj;
			    if (!acc[id_tipo_subsidio]) {
			        acc[id_tipo_subsidio] = [];
			    }
			    acc[id_tipo_subsidio].push(obj);
			    return acc;
			}, {});

			res.send(agrupado);
		}
	})
});

app.get('/get-oracoes', (req, res) => {

	let sql = 	`SELECT tb_oracoes.*, tb_tipos_oracoes.nome_tipo_oracao
				 FROM tb_oracoes
				 LEFT JOIN tb_tipos_oracoes ON tb_oracoes.id_tipo_oracao = tb_tipos_oracoes.id_tipo_oracao;`;

	db.query(sql, (err, result) => {
		if (err) console.log(err);
		else {
			res.send(result);
		}
	})
});

app.get('/get-subsidios', (req, res) => {

	let sql = 	`SELECT tb_subsidios.*, 
				 CASE 
					 WHEN tb_subsidios.tipo_subsidio = 2 THEN CONCAT(tb_subdivisao_subsidio.categoria_subdivisao, " - ", tb_subdivisao_subsidio.nome_subdivisao_subsidio)
				     ELSE tb_subsidios.tipo_documento
				 END as nome_subdivisao_subsidio
				 FROM tb_subsidios
				 LEFT JOIN tb_subdivisao_subsidio ON tb_subdivisao_subsidio.id_subdivisao_subsidio = tb_subsidios.id_subdivisao_subsidio;`;

	db.query(sql, (err, result) => {
		if (err) console.log(err);
		else {
			res.send(result);
		}
	})
});

app.get('/get-tipos-subsidios', (req, res) => {

	let sql = 	`SELECT tipo_documento, tipo_subsidio
				 FROM tb_subsidios
                 GROUP BY tipo_documento, tipo_subsidio;`;

	db.query(sql, (err, result) => {
		if (err) console.log(err);
		else {
			const agrupado = result.reduce((acc, obj) => {
			   const { tipo_subsidio, ...resto } = obj;
			    if (!acc[tipo_subsidio]) {
			        acc[tipo_subsidio] = [];
			    }
			    acc[tipo_subsidio].push(obj["tipo_documento"]);
			    return acc;
			}, {});

			res.send(agrupado);
		}
	})
});

app.get('/get-missas-da-musica', (req, res) => {

	let sql = 	`SELECT id_missa as id, nome
				 FROM tb_musicas_missas
				 JOIN tb_missas ON tb_musicas_missas.id_missa = tb_missas.id
				 WHERE tb_musicas_missas.id_musica = ?`;

	db.query(sql, req.query.idMusica, (err, result) => {
		if (err) console.log(err);
		else {
			res.send(result);
		}
	})
});

app.get('/get-subsidios-agrupados', (req, res) => {

	let sql;

	if (req.query.tipo_subsidio == 2) {
		sql = ` SELECT id_subdivisao_subsidio, id_tipo_subsidio, nome_subdivisao_subsidio, categoria_subdivisao, 
				CASE
					WHEN id_tipo_subsidio = 1 THEN CONCAT("/documentos/tema/",url)
				    WHEN id_tipo_subsidio = 2 THEN CONCAT("/roteiros/tema/",url)
				    WHEN id_tipo_subsidio = 3 THEN CONCAT("/rituais/tema/",url)
				END AS url,
				CONCAT(categoria_subdivisao, " - " , nome_subdivisao_subsidio) as id
				FROM tb_subdivisao_subsidio
				WHERE id_tipo_subsidio = ?
				ORDER BY categoria_subdivisao`;
	} else {
		sql = `SELECT nome_documento as nome_subdivisao_subsidio, caminho_arquivo as url, tipo_documento as categoria_subdivisao,
			   nome_documento as id
			   FROM tb_subsidios
			   WHERE tipo_subsidio = ?
			   ORDER BY nome_documento`;
	}

	db.query(sql, req.query.tipo_subsidio, (err, result) => {
		if (err) console.log(err);
		else {

			const agrupado = result.reduce((acc, obj) => {
			const { categoria_subdivisao, ...resto } = obj;
			    if (!acc[categoria_subdivisao]) {
			        acc[categoria_subdivisao] = [];
			    }
			    acc[categoria_subdivisao].push(resto);
			    return acc;
			}, {});

			res.send(agrupado);
		}
	})
});

app.get('/subsidios-possiveis-pesquisa', (req, res) => {

	let sql;
	if (req.query.tipo_subsidio == 2) {
		sql = ` (SELECT CONCAT(categoria_subdivisao, " - ", nome_subdivisao_subsidio) as nome, 1 as sessao,
                CASE 
                	WHEN id_tipo_subsidio = 1 THEN CONCAT("/documentos/tema/",url)
				    WHEN id_tipo_subsidio = 2 THEN CONCAT("/roteiros/tema/",url)
				    WHEN id_tipo_subsidio = 3 THEN CONCAT("/rituais/tema/",url)
                END AS url
				FROM tb_subdivisao_subsidio
				WHERE id_tipo_subsidio = ?)
	            UNION 
	            (SELECT categoria_subdivisao as nome, 0 as sessao, categoria_subdivisao as url         
	             FROM tb_subdivisao_subsidio
	             WHERE id_tipo_subsidio = ?
	            );`;
	} else {
		sql = ` SELECT * FROM ((SELECT tipo_documento as nome, 0 as sessao, '' as url
				FROM tb_subsidios WHERE tipo_subsidio = ?)
					UNION
				(SELECT nome_documento as nome, 1 as sessao, caminho_arquivo as url
				FROM tb_subsidios  WHERE tipo_subsidio = ?)) as tabelinha
				ORDER BY nome;`;
	}

	db.query(sql, [req.query.tipo_subsidio, req.query.tipo_subsidio],(err, result) => {
		if (err) console.log(err);
		else {
			var tempDict = {"sessoes": {}, "links": {}};
			for (let i = 0; i < result.length; i++) {
				if (result[i]["sessao"] == 1) {
					tempDict["sessoes"][result[i]["nome"]] = result[i]["url"];
				} else {
					tempDict["links"][result[i]["nome"]] = result[i]["url"];
				}
			}
			res.send(tempDict);
		}
	})
});

app.get('/informacao-oracao', (req, res) => {

	let sql = 	`SELECT *
				 FROM tb_oracoes
				 WHERE url = ?`;

	db.query(sql, req.query.url, (err, result) => {
		if (err) console.log(err);
		else {
			res.send(result[0]);
		}
	})
});

app.get('/get-artigos-recentes', (req, res) => {

	let sql = 	`
		SELECT id, url, nome, resumo, TO_BASE64(imagem) as imagem, views, tema, DATE_FORMAT(dataCriacao, '%d/%m/%Y') AS dataCriacao 
		FROM tb_artigos 
		WHERE dataCriacao <= CURDATE()
		ORDER BY dataCriacao DESC`;

	db.query(sql, (err, result) => {
		if (err) console.log(err);
		else {
			res.send(result);
		}
	})
});

app.get('/get-artigos-destaque', (req, res) => {

	let sql = 	`SELECT id, url, nome, resumo, TO_BASE64(imagem) as imagem, views, tema, DATE_FORMAT(dataCriacao, '%d/%m/%Y') AS dataCriacao FROM (
				(SELECT * FROM tb_artigos WHERE dataCriacao <= CURDATE() ORDER BY dataCriacao DESC LIMIT 3)
				UNION
				(SELECT * FROM tb_artigos WHERE dataCriacao <= CURDATE() ORDER BY views DESC)
				) as tabelinda`;

	db.query(sql, (err, result) => {
		if (err) console.log(err);
		else {
			res.send(result);
		}
	})
});

app.get('/get-artigos-por-categoria', (req, res) => {

	let sql = `
		SELECT id, url, nome, resumo, TO_BASE64(imagem) as imagem, views, tema, DATE_FORMAT(dataCriacao, '%d/%m/%Y') AS dataCriacao 
		FROM tb_artigos 
		WHERE dataCriacao <= CURDATE()
		ORDER BY dataCriacao DESC`;

	db.query(sql, (err, result) => {
		if (err) console.log(err);
		else {
			const agrupado = result.reduce((acc, obj) => {
			   const { tema, ...resto } = obj;
			    if (!acc[tema]) {
			        acc[tema] = [];
			    }
			    acc[tema].push(resto);
			    return acc;
			}, {});

			res.send(agrupado);
		}
	})
});

app.get('/get-artigo-by-url', (req, res) => {

	let sql = 	`UPDATE tb_artigos
				 SET views = views + 1
				 WHERE url = ?`;

	db.query(sql, req.query.url, (err, result) => {
		if (err) console.log("Go go");
		else {
			console.log("Go go");
		}
	})

	sql = 	`    SELECT id, url, nome, resumo, autor, REPLACE(REPLACE(CONVERT(artigo_html USING utf8), '<p', '<p id=\"portal-da-liturgia\"'), '<span', '<span id=\"portal-da-liturgia\"') as artigo_html, views, tema, DATE_FORMAT(dataCriacao, '%d/%m/%Y') AS dataCriacao FROM tb_artigos
				 WHERE url = ?
				 ORDER BY dataCriacao DESC`;

	db.query(sql, req.query.url, (err, result) => {
		if (err) console.log(err);
		else {
			res.send(result[0]);
		}
	})
});

app.get('/get-all-artigos', (req, res) => {

	let sql = 	`SELECT id, url, nome, resumo, autor, views, tema, dataCriacao FROM tb_artigos
				 ORDER BY dataCriacao DESC`;

	db.query(sql, req.query.url, (err, result) => {
		if (err) console.log(err);
		else {
			res.send(result);
		}
	})
});

app.get('/get-possible-temas', (req, res) => {

	let sql = `SELECT DISTINCT(tema) FROM tb_artigos;`;

	db.query(sql, req.query.url, (err, result) => {
		if (err) console.log(err);
		else {
			var lista = [];
			for (var i = 0; i < result.length; i++) {
				lista.push(result[i].tema);
			}
			res.send(lista);
		}
	})
});

app.get('/logar', (req, res) => {

	try {
		let sql = 	`SELECT token
				 FROM tb_usuarios
				 WHERE login = ?
				 AND senha = ?`;

		db.query(sql, [req.query.login, req.query.senhaEncriptada],(err, result) => {
			if (err) res.send(false);
			else {
				if (result.length == 0) res.send(false);
				else res.send(result[0].token);
			}
		})
	} catch {
		res.send(false);
	}
});

const checaToken = (token) => {
	try {
		let sql = 	`SELECT login
				 FROM tb_usuarios
				 WHERE token=?`;

		db.query(sql, token, (err, result) => {
			if (err) return false;
			else {
				if (result.length == 0) return false;
				else return true;
			}
		})
	} catch {
		return false;
	}
}

app.get('/autenticar', (req, res) => {

	res.send(checaToken(req.query.token));

});

app.post('/cadastrar-musica', (req, res) => {

	if (checaToken(req.body.token) == false) {
		res.send("O usuário não está autenticado");
	} else {
		try {
			let sql = 	`INSERT INTO tb_musicas(nome, autor, cifra, parteMissaList, url, url_youtube, link_partitura, lingua, tempo_liturgico)
					 	 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
					 	`;

			console.log("Our query is");
			console.log(sql);

			db.query(sql, [req.body.nome, req.body.autor, req.body.cifra.replaceAll("\n", "\\\\n"), req.body.parteMissa, req.body.url, req.body.url_youtube, req.body.link_partitura, req.body.lingua, req.body.tempo_liturgico],(err, result) => {
				if (err) res.send(false);
				else res.send(true);
			})
		} catch {
			res.send(false);
		}
	}
});

app.post('/cadastrar-oracao', (req, res) => {

	console.log("body is");
	console.log(req.body);

	if (checaToken(req.body.token) == false) {
		res.send("O usuário não está autenticado");
	} else {
		try {
			let sql = 	`INSERT INTO tb_oracoes(id_tipo_oracao, texto_oracao_pt, texto_oracao_lt, nome_oracao, url)
					 	 VALUES (?, ?, ?, ?, ?);
					 	`;

			console.log("Our query is");
			console.log(sql);

			db.query(sql, [req.body.id_tipo_oracao, req.body.texto_oracao_pt, req.body.texto_oracao_lt, req.body.nome_oracao, req.body.url], (err, result) => {
				if (err) res.send(false);
				else res.send(true);
			})
		} catch {
			res.send(false);
		}
	}
});

app.post('/cadastrar-subsidio', (req, res) => {

	console.log("body is");
	console.log(req.body);

	if (checaToken(req.body.token) == false) {
		res.send("O usuário não está autenticado");
	} else {
		try {

			if (req.body.tipo_subsidio == 2) {
				let sql = 	`INSERT INTO tb_subsidios(nome_documento, caminho_arquivo, tipo_subsidio, id_subdivisao_subsidio)
					 	 VALUES (?, ?, ?, ?);
					 	`;

				console.log("Our query is");
				console.log(sql);

				db.query(sql, [req.body.nome_documento, req.body.caminho_arquivo, req.body.tipo_subsidio, req.body.id_subdivisao_subsidio], (err, result) => {
					if (err) res.send(false);
					else res.send(true);
				})
			} else {
				let sql = 	`INSERT INTO tb_subsidios(nome_documento, caminho_arquivo, tipo_documento, tipo_subsidio)
					 	 VALUES (?, ?, ?, ?);
					 	`;

				console.log("Our query is");
				console.log(sql);

				db.query(sql, [req.body.nome_documento, req.body.caminho_arquivo, req.body.tipo_documento, req.body.tipo_subsidio], (err, result) => {
					if (err) res.send(false);
					else res.send(true);
				})
			}
			
		} catch {
			res.send(false);
		}
	}
});

app.post('/cadastrar-tipos-oracoes', (req, res) => {

	console.log("body is");
	console.log(req.body);

	if (checaToken(req.body.token) == false) {
		res.send("O usuário não está autenticado");
	} else {
		try {
			let sql = 	`INSERT INTO tb_tipos_oracoes(nome_tipo_oracao, categoria_oracao, url)
					 	 VALUES (
					 	 	?, 
					 	 	?, 
					 	 	?
					 	 );
					 	`;

			console.log("Our query is");
			console.log(sql);

			db.query(sql, [req.body.nome_tipo_oracao, req.body.categoria_oracao, req.body.url], (err, result) => {
				if (err) res.send(false);
				else res.send(true);
			})
		} catch {
			res.send(false);
		}
	}
});

app.post('/cadastrar-subdivisao-subsidio', (req, res) => {

	console.log("body is");
	console.log(req.body);

	if (checaToken(req.body.token) == false) {
		res.send("O usuário não está autenticado");
	} else {
		try {
			let sql = 	`INSERT INTO tb_subdivisao_subsidio(categoria_subdivisao, nome_subdivisao_subsidio, id_tipo_subsidio, url)
					 	 VALUES (
					 	 	?, 
					 	 	?, 
					 	 	?,
					 	 	?
					 	 );
					 	`;

			console.log("Our query is");
			console.log(sql);

			db.query(sql, [req.body.categoria_subdivisao, req.body.nome_subdivisao_subsidio, req.body.id_tipo_subsidio, req.body.url], (err, result) => {
				if (err) res.send(false);
				else res.send(true);
			})
		} catch {
			res.send(false);
		}
	}
});

function base64toBlob(base64Data, contentType) {
    contentType = contentType || '';
    var sliceSize = 1024;
    var byteCharacters = atob(base64Data);
    var bytesLength = byteCharacters.length;
    var slicesCount = Math.ceil(bytesLength / sliceSize);
    var byteArrays = new Array(slicesCount);

    for (var sliceIndex = 0; sliceIndex < slicesCount; ++sliceIndex) {
        var begin = sliceIndex * sliceSize;
        var end = Math.min(begin + sliceSize, bytesLength);

        var bytes = new Array(end - begin);
        for (var offset = begin, i = 0; offset < end; ++i, ++offset) {
            bytes[i] = byteCharacters[offset].charCodeAt(0);
        }
        byteArrays[sliceIndex] = new Uint8Array(bytes);
    }
    return new Blob(byteArrays, { type: contentType });
}

app.post('/cadastrar-artigo', (req, res) => {

	if (checaToken(req.body.token) == false) {
		res.send("O usuário não está autenticado");
	} else {
		try {

			var artigo = base64toBlob(req.body.artigo.base64, req.body.artigo.tipo)["buffer"];

			var imagem = base64toBlob(req.body.imagem.base64, req.body.imagem.tipo)["buffer"];

			let sql = `INSERT INTO tb_artigos(url, nome, artigo_html, resumo, imagem, tema, autor, dataCriacao)
							 VALUES(?, ?, ?, ?, ?, ?, ?, ?);
					 	`;

			var listaCampos = [req.body.url, req.body.nome, artigo, req.body.resumo, imagem, req.body.tema, req.body.autor, req.body.dataCriacao];

			db.query(sql, listaCampos, (err, result) => {
				if (err) {
					console.log(err);
					res.send(false)
				} else res.send(true);
			})
		} catch(error) {
			console.log(error)
			res.send(false);
		}
	}
});

app.post('/update-artigo', (req, res) => {

	if (checaToken(req.body.token) == false) {
		res.send("O usuário não está autenticado");
	} else {
		try {

			var sql;

			if (req.body.mudarArtigo && req.body.mudarImagem) {

				var artigo = base64toBlob(req.body.artigo.base64, req.body.artigo.tipo)["buffer"];

				var imagem = base64toBlob(req.body.imagem.base64, req.body.imagem.tipo)["buffer"];

				sql = `UPDATE tb_artigos
							 SET url = ?,
							 nome = ?,
							 artigo_html = ?,
							 resumo = ?,
							 imagem = ?,
							 tema = ?,
							 autor = ?,
							 dataCriacao = ?
							 WHERE id=?
					 	`;
				var listaCampos = [req.body.url, req.body.nome, artigo, req.body.resumo, imagem, req.body.tema, req.body.autor, req.body.dataCriacao, req.body.id];
			} else if (req.body.mudarArtigo) {

				var artigo = base64toBlob(req.body.artigo.base64, req.body.artigo.tipo)["buffer"];

				sql = `UPDATE tb_artigos
							 SET url = ?,
							 nome = ?,
							 artigo_html = ?,
							 resumo = ?,
							 tema = ?,
							 autor = ?,
							 dataCriacao = ?
							 WHERE id=?
					 	`;
				var listaCampos = [req.body.url, req.body.nome, artigo, req.body.resumo, req.body.tema, req.body.autor, req.body.dataCriacao, req.body.id];
			} else if (req.body.mudarImagem) {

				var imagem = base64toBlob(req.body.imagem.base64, req.body.imagem.tipo)["buffer"];

				sql = `UPDATE tb_artigos
							 SET url = ?,
							 nome = ?,
							 imagem = ?,
							 resumo = ?,
							 tema = ?,
							 autor = ?,
							 dataCriacao = ?
							 WHERE id=?
					 	`;
				var listaCampos = [req.body.url, req.body.nome, imagem, req.body.resumo, req.body.tema, req.body.autor, req.body.dataCriacao, req.body.id];
			} else {
				sql = `UPDATE tb_artigos
							 SET url = ?,
							 nome = ?,
							 resumo = ?,
							 tema = ?,
							 autor = ?,
							 dataCriacao = ?
							 WHERE id=?
					 	`;
				var listaCampos = [req.body.url, req.body.nome, req.body.resumo, req.body.tema, req.body.autor, req.body.dataCriacao, req.body.id];
			}

			db.query(sql, listaCampos, (err, result) => {
				if (err) {
					console.log(err);
					res.send(false)
				}
				else {
					res.send(true);
				};
			})
		} catch(err) {
			console.log(err);
			res.send(false);
		}
	}
});

app.post('/delete-registry', (req, res) => {

	console.log("body is");
	console.log(req.body);

	if (checaToken(req.body.token) == false) {
		res.send("O usuário não está autenticado");
	} else {
		try {
			let sql = 	`DELETE FROM ${req.body.table_name}
						 WHERE id = ?
					 	`;

			console.log("Our query is");
			console.log(sql);

			db.query(sql, req.body.id_to_delete, (err, result) => {
				if (err) {
					console.log(err);
				}
				else res.send(true);
			})
		} catch {
			console.log(err);
		}
	}
});

app.post('/update-musica', (req, res) => {

	console.log("body is");
	console.log(req.body);

	if (checaToken(req.body.token) == false) {
		res.send("O usuário não está autenticado");
	} else {
		try {
			let sql = 	`UPDATE tb_musicas
						 SET nome = ?,
						 autor = ?,
						 cifra = ?,
						 parteMissaList = ?,
						 url = ?,
						 url_youtube = ?,
						 link_partitura = ?,
						 lingua = ?,
						 tempo_liturgico = ?
					 	 WHERE id = ?;
					 	`;

			console.log("Our query is");
			console.log(sql);

			db.query(sql, [req.body.nome, req.body.autor, req.body.cifra.replaceAll("\n", "\\\\n"), req.body.parteMissa, req.body.url, req.body.url_youtube, req.body.link_partitura, req.body.lingua, req.body.tempo_liturgico, req.body.id], (err, result) => {
				if (err) {
					console.log(err);
				}
				else res.send(true);
			})
		} catch {
			console.log(err);
		}
	}
});

app.post('/cadastrar-missa', (req, res) => {

	console.log("body is");
	console.log(req.body);

	if (checaToken(req.body.token) == false) {
		res.send("O usuário não está autenticado");
	} else {
		try {
			let sql = 	`INSERT INTO tb_missas(nome, url, ehSolenidade, ehOcasiaoEspecial)
					 	 VALUES (?, ?, ?, ?);
					 	`;

			console.log("Our query is");
			console.log(sql);

			db.query(sql, [req.body.nome, req.body.url, req.body.ehSolenidade, req.body.ehOcasiaoEspecial], (err, result) => {
				if (err) console.log(err);
				else res.send(true);
			})
		} catch {
			console.log(err);
		}
	}
});

app.post('/cadastrar-data-missa', (req, res) => {

	console.log("body is");
	console.log(req.body);

	if (checaToken(req.body.token) == false) {
		res.send("O usuário não está autenticado");
	} else {
		try {
			let sql = 	`INSERT INTO tb_calendario(id_missa, data)
					 	 VALUES (?, ?);
					 	`;

			console.log("Our query is");
			console.log(sql);

			db.query(sql, [req.body.id_missa, req.body.data], (err, result) => {
				if (err) console.log(err);
				else res.send(true);
			})
		} catch {
			console.log(err);
		}
	}
});

app.post('/update-oracao', (req, res) => {

	console.log("body is");
	console.log(req.body);

	if (checaToken(req.body.token) == false) {
		res.send("O usuário não está autenticado");
	} else {
		try { // nome, , , 
			let sql = 	`UPDATE tb_oracoes
						 SET id_tipo_oracao = ?,
						 url = ?,
						 texto_oracao_pt = ?,
						 texto_oracao_lt = ?,
						 nome_oracao = ?
						 WHERE id=?
					 	`;

			console.log("Our query is");
			console.log(sql);

			db.query(sql, [req.body.id_tipo_oracao, req.body.url, req.body.texto_oracao_pt, req.body.texto_oracao_lt, req.body.nome_oracao, req.body.id], (err, result) => {
				if (err) {
					console.log(err);
					res.send(false)
				}
				else res.send(true);
			})
		} catch {
			res.send(false);
		}
	}
});

app.post('/update-subsidio', (req, res) => {

	console.log("body is");
	console.log(req.body);

	if (checaToken(req.body.token) == false) {
		res.send("O usuário não está autenticado");
	} else {
		try { // nome, , , 
			let sql = 	`UPDATE tb_subsidios
						 SET nome_documento = ?,
						 caminho_arquivo = ?,
						 tipo_documento = ?,
						 tipo_subsidio = ?,
						 id_subdivisao_subsidio = ?
						 WHERE id=?
					 	`;

			console.log("Our query is");
			console.log(sql);

			db.query(sql, [req.body.nome_documento, req.body.caminho_arquivo, req.body.tipo_documento, req.body.tipo_subsidio, req.body.id_subdivisao_subsidio, req.body.id], (err, result) => {
				if (err) {
					console.log(err);
					res.send(false)
				}
				else res.send(true);
			})
		} catch {
			res.send(false);
		}
	}
});

app.post('/update-missa', (req, res) => {

	console.log("body is");
	console.log(req.body);

	if (checaToken(req.body.token) == false) {
		res.send("O usuário não está autenticado");
	} else {
		try { // nome, , , 
			let sql = 	`UPDATE tb_missas
						 SET nome = ?,
						 url = ?,
						 ehSolenidade = ?,
						 ehOcasiaoEspecial = ?
						 WHERE id=?
					 	`;

			console.log("Our query is");
			console.log(sql);

			db.query(sql, [req.body.nome, req.body.url, req.body.ehSolenidade, req.body.ehOcasiaoEspecial, req.body.id], (err, result) => {
				if (err) {
					console.log(err);
					res.send(false)
				}
				else res.send(true);
			})
		} catch {
			res.send(false);
		}
	}
});

app.post('/update-data-missa', (req, res) => {

	console.log("body is");
	console.log(req.body);

	if (checaToken(req.body.token) == false) {
		res.send("O usuário não está autenticado");
	} else {
		try {
			let sql = 	`UPDATE tb_calendario
						 SET id_missa = ?,
						 data = ?
						 WHERE id=?
					 	`;

			console.log("Our query is");
			console.log(sql);

			db.query(sql, [req.body.id_missa, req.body.data, req.body.id], (err, result) => {
				if (err) {
					console.log(err);
					res.send(false)
				}
				else res.send(true);
			})
		} catch {
			res.send(false);
		}
	}
});

app.post('/update-subdivisao-subsidio', (req, res) => {

	console.log("body is");
	console.log(req.body);

	if (checaToken(req.body.token) == false) {
		res.send("O usuário não está autenticado");
	} else {
		try {
			let sql = 	`UPDATE tb_subdivisao_subsidio
						 SET categoria_subdivisao = ?,
						 nome_subdivisao_subsidio = ?,
						 id_tipo_subsidio = ?,
						 url = ?
						 WHERE id_subdivisao_subsidio=?
					 	`;

			console.log("Our query is");
			console.log(sql);

			db.query(sql, [req.body.categoria_subdivisao, req.body.nome_subdivisao_subsidio, req.body.id_tipo_subsidio, req.body.url, req.body.id_subdivisao_subsidio], (err, result) => {
				if (err) {
					console.log(err);
					res.send(false)
				}
				else res.send(true);
			})
		} catch {
			res.send(false);
		}
	}
});

app.post('/update-tipos-oracoes', (req, res) => {

	console.log("body is");
	console.log(req.body);

	if (checaToken(req.body.token) == false) {
		res.send("O usuário não está autenticado");
	} else {
		try {
			let sql = 	`UPDATE tb_tipos_oracoes
						 SET nome_tipo_oracao = ?,
						 categoria_oracao = ?
						 WHERE id_tipo_oracao=?
					 	`;

			console.log("Our query is");
			console.log(sql);

			db.query(sql, [req.body.nome_tipo_oracao, req.body.categoria_oracao, req.body.id_tipo_oracao], (err, result) => {
				if (err) {
					console.log(err);
					res.send(false)
				}
				else res.send(true);
			})
		} catch {
			res.send(false);
		}
	}
});

app.post('/cadastrar-musicas-por-missa', (req, res) => {

	if (checaToken(req.body.token) == false) {
		res.send("O usuário não está autenticado");
	} else {
		try {

			var tempStringValues = "VALUES ";
			var tempDeleteString = "AND id_missa NOT IN ("
			for (var i = 0; i < req.body.array_id_missa.length; i++) {
				if (i == 0) {
					tempDeleteString += `${req.body.array_id_missa[i]}`;
					tempStringValues += `(${req.body.array_id_missa[i]}, ${req.body.id_musica})`;
				} else {
					tempStringValues += `, (${req.body.array_id_missa[i]}, ${req.body.id_musica})`;
					tempDeleteString += `, ${req.body.array_id_missa[i]}`;
				}
			}

			if (req.body.array_id_missa.length > 0) {
				tempDeleteString += ")";
			} else {
				tempDeleteString = "";
			}

			let sql = 	`DELETE FROM tb_musicas_missas
					 	 WHERE id_musica=${req.body.id_musica}
					 	 ${tempDeleteString};
					 	`;

			console.log("Our query is");
			console.log(sql);

			db.query(sql, (err, result) => {
				if (err) console.log(err);
				else {
					sql = 	`INSERT IGNORE INTO tb_musicas_missas(id_missa, id_musica)
					 	 ${tempStringValues};
					 	`;

					console.log("Our query is");
					console.log(sql);

					db.query(sql, (err, result) => {
						res.send(true);
					});
				}
			});

		} catch {
			console.log("erro");
		}
	}
});

app.listen(3001, () => {
	console.log("Rodando servidor");
});
  
