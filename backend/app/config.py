"""環境変数の読み込み。Azure では Web App の「アプリ設定」、手元では backend/.env に書きます。"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    db_host: str = "localhost"
    db_port: int = 3306
    db_name: str = "michisuji"
    db_user: str = ""
    db_password: str = ""
    # Azure の MySQL は SSL 必須。手元の MySQL で SSL を使わないときは false にする
    db_ssl: bool = True
    # 指定すると上の DB_* より優先（例：sqlite:///./local.db）
    database_url: str = ""

    # フロントのURL（カンマ区切り）
    cors_origins: str = "http://localhost:3000"
    # 表示する会社（MVPは1社）
    company_id: int = 1
    # 起動時にテーブルを作り、空なら初期データを入れる
    auto_seed: bool = True

    @property
    def cors_list(self) -> list[str]:
        return [o.strip().rstrip("/") for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
