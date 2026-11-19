-- ミチスジ テーブル定義（MySQL 8.0 / Azure Database for MySQL フレキシブル サーバー）
-- app/models.py から作ったもの。設計の説明：docs/design/ミチスジ_システム設計書 8章
-- 通常はバックエンドの起動時に自動で作られるので、手で流す必要はありません。
SET NAMES utf8mb4;

CREATE TABLE company (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	name VARCHAR(100) NOT NULL, 
	industry VARCHAR(100) NOT NULL, 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	PRIMARY KEY (id)
)CHARSET=utf8mb4 ENGINE=InnoDB COMMENT='会社';

CREATE TABLE reference_data (
	`key` VARCHAR(40) NOT NULL, 
	body JSON NOT NULL, 
	updated_at DATETIME NOT NULL, 
	PRIMARY KEY (`key`)
)CHARSET=utf8mb4 ENGINE=InnoDB COMMENT='他社の点・参加企業の集計の初期データ';

CREATE TABLE business_unit (
	company_id INTEGER NOT NULL, 
	id VARCHAR(40) NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	industry VARCHAR(100) NOT NULL, 
	share SMALLINT NOT NULL, 
	owner_name VARCHAR(100) NOT NULL, 
	cvp SMALLINT NOT NULL, 
	customer TEXT NOT NULL, 
	future TEXT NOT NULL, 
	gap VARCHAR(200) NOT NULL, 
	growth SMALLINT NOT NULL, 
	conf_by VARCHAR(100) NOT NULL, 
	conf_at DATE, 
	sort_order INTEGER NOT NULL, 
	deleted_at DATETIME, 
	PRIMARY KEY (company_id, id), 
	FOREIGN KEY(company_id) REFERENCES company (id)
)CHARSET=utf8mb4 ENGINE=InnoDB COMMENT='事業';

CREATE TABLE change_note (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	company_id INTEGER NOT NULL, 
	confirmation_id BIGINT, 
	text VARCHAR(500) NOT NULL, 
	sort_order INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(company_id) REFERENCES company (id)
)CHARSET=utf8mb4 ENGINE=InnoDB COMMENT='初期データの「変わったこと」';

CREATE TABLE initiative (
	company_id INTEGER NOT NULL, 
	id VARCHAR(40) NOT NULL, 
	name VARCHAR(200) NOT NULL, 
	owner ENUM('biz','dx','mgmt') NOT NULL, 
	partner VARCHAR(100) NOT NULL, 
	digital BOOL NOT NULL, 
	ipa SMALLINT, 
	ev VARCHAR(300) NOT NULL, 
	chk_condition BOOL NOT NULL, 
	chk_review BOOL NOT NULL, 
	kpi VARCHAR(200) NOT NULL, 
	base VARCHAR(100) NOT NULL, 
	target VARCHAR(100) NOT NULL, 
	sort_order INTEGER NOT NULL, 
	deleted_at DATETIME, 
	PRIMARY KEY (company_id, id), 
	FOREIGN KEY(company_id) REFERENCES company (id)
)CHARSET=utf8mb4 ENGINE=InnoDB COMMENT='施策';

CREATE TABLE initiative_objective (
	company_id INTEGER NOT NULL, 
	initiative_id VARCHAR(40) NOT NULL, 
	objective_id VARCHAR(40) NOT NULL, 
	sort_order INTEGER NOT NULL, 
	PRIMARY KEY (company_id, initiative_id, objective_id), 
	FOREIGN KEY(company_id) REFERENCES company (id)
)CHARSET=utf8mb4 ENGINE=InnoDB COMMENT='施策が付く目標';

CREATE TABLE initiative_progress (
	company_id INTEGER NOT NULL, 
	initiative_id VARCHAR(40) NOT NULL, 
	exec SMALLINT NOT NULL, 
	verify SMALLINT NOT NULL, 
	kpi_cur VARCHAR(100), 
	did TEXT NOT NULL, 
	result TEXT NOT NULL, 
	author VARCHAR(100) NOT NULL, 
	updated_at DATETIME(6) NOT NULL, 
	PRIMARY KEY (company_id, initiative_id), 
	FOREIGN KEY(company_id) REFERENCES company (id)
)CHARSET=utf8mb4 ENGINE=InnoDB COMMENT='施策の進捗（担当者の入力。上書き）';

CREATE TABLE link (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	company_id INTEGER NOT NULL, 
	bu_id VARCHAR(40) NOT NULL, 
	from_id VARCHAR(40) NOT NULL, 
	to_id VARCHAR(40) NOT NULL, 
	reason TEXT NOT NULL, 
	cond TEXT NOT NULL, 
	check_text TEXT NOT NULL, 
	check_date VARCHAR(50) NOT NULL, 
	sort_order INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(company_id) REFERENCES company (id)
)CHARSET=utf8mb4 ENGINE=InnoDB COMMENT='目標どうしのつながり（因果の仮説）';

CREATE TABLE objective (
	company_id INTEGER NOT NULL, 
	id VARCHAR(40) NOT NULL, 
	bu_id VARCHAR(40), 
	persp ENUM('lg','pr','cu','fi') NOT NULL, 
	name VARCHAR(200) NOT NULL, 
	kpi VARCHAR(200) NOT NULL, 
	base VARCHAR(100) NOT NULL, 
	target VARCHAR(100) NOT NULL, 
	due VARCHAR(100) NOT NULL, 
	owner ENUM('biz','dx','mgmt') NOT NULL, 
	partner VARCHAR(100) NOT NULL, 
	theme_id VARCHAR(40), 
	cap ENUM('hum','inf','org'), 
	fin_kind SMALLINT, 
	sort_order INTEGER NOT NULL, 
	deleted_at DATETIME, 
	PRIMARY KEY (company_id, id), 
	FOREIGN KEY(company_id) REFERENCES company (id)
)CHARSET=utf8mb4 ENGINE=InnoDB COMMENT='目標（全社の目標は bu_id が NULL）';

CREATE TABLE objective_progress (
	company_id INTEGER NOT NULL, 
	objective_id VARCHAR(40) NOT NULL, 
	value VARCHAR(100) NOT NULL, 
	at DATE, 
	reason SMALLINT, 
	memo TEXT NOT NULL, 
	author VARCHAR(100) NOT NULL, 
	updated_at DATETIME(6) NOT NULL, 
	PRIMARY KEY (company_id, objective_id), 
	FOREIGN KEY(company_id) REFERENCES company (id)
)CHARSET=utf8mb4 ENGINE=InnoDB COMMENT='目標の進捗（担当者の入力。上書き）';

CREATE TABLE progress_confirmation (
	id BIGINT NOT NULL AUTO_INCREMENT, 
	company_id INTEGER NOT NULL, 
	label VARCHAR(50) NOT NULL, 
	as_of DATE NOT NULL, 
	body JSON NOT NULL, 
	confirmed_by VARCHAR(100) NOT NULL, 
	confirmed_at DATETIME(6) NOT NULL, 
	is_seed BOOL NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_confirmation_label UNIQUE (company_id, label), 
	FOREIGN KEY(company_id) REFERENCES company (id)
)CHARSET=utf8mb4 ENGINE=InnoDB COMMENT='進捗の確定版（他社と比べる画面に出る）';

CREATE TABLE strategy_version (
	id BIGINT NOT NULL AUTO_INCREMENT, 
	company_id INTEGER NOT NULL, 
	saved_at DATETIME NOT NULL, 
	body JSON NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(company_id) REFERENCES company (id)
)CHARSET=utf8mb4 ENGINE=InnoDB COMMENT='申請の版';

CREATE TABLE theme (
	company_id INTEGER NOT NULL, 
	id VARCHAR(40) NOT NULL, 
	bu_id VARCHAR(40) NOT NULL, 
	name VARCHAR(200) NOT NULL, 
	hz SMALLINT NOT NULL, 
	sort_order INTEGER NOT NULL, 
	deleted_at DATETIME, 
	PRIMARY KEY (company_id, id), 
	FOREIGN KEY(company_id) REFERENCES company (id)
)CHARSET=utf8mb4 ENGINE=InnoDB COMMENT='戦略テーマ';


CREATE TABLE open_business_snapshot (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	company_id INTEGER NOT NULL, 
	company_name VARCHAR(100) NOT NULL, 
	company_industry VARCHAR(100) NOT NULL, 
	bu_id VARCHAR(40) NOT NULL, 
	bu_name VARCHAR(100) NOT NULL, 
	bu_industry VARCHAR(100) NOT NULL, 
	as_of_label VARCHAR(50) NOT NULL, 
	as_of DATE, 
	confirmed_at DATETIME NOT NULL, 
	stage SMALLINT NOT NULL, 
	progress SMALLINT NOT NULL, 
	obj_total INTEGER NOT NULL, 
	obj_reach_fin INTEGER NOT NULL, 
	kpi_lg INTEGER NOT NULL, 
	kpi_pr INTEGER NOT NULL, 
	kpi_cu INTEGER NOT NULL, 
	kpi_fi INTEGER NOT NULL, 
	init_total INTEGER NOT NULL, 
	init_condition INTEGER NOT NULL, 
	init_review INTEGER NOT NULL, 
	init_verified INTEGER NOT NULL, 
	extracted_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_open_company_bu UNIQUE (company_id, bu_id)
)CHARSET=utf8mb4 ENGINE=InnoDB COMMENT='抽象化した事業ごとの現在地（オープンなDBの代わり。1行＝1社の1事業）';
CREATE INDEX ix_open_business_snapshot_company_id ON open_business_snapshot (company_id);
