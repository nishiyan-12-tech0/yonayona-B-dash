"""デモの初期状態：申請済みで戦略マップがあり、約1年ぶんの進捗と四半期ごとの版が入った状態を作る。

seed.insert_seed（初回の起動・「デモを初期状態に戻す」）の最後に呼ぶ。
入力済みの作成中の申請から申請を作り、四半期末ごとに「進捗を入れて版を作る」を繰り返す。
日付は今日から逆算するので、いつリセットしても「約1年前に申請し、直近まで進捗を入れてきた」状態になる。

ストーリー（架空）：
- 産業機器事業：全社データ基盤（DX）を起点に、稼働データ → 保守提案 → 保守契約の継続 → 売上と、
  四半期ごとに道筋が一つずつ右へ進み、今は財務まで届いている。稼働データの目標は達成済み。
- 計測機器事業：人材・データ・開発期間までは動いたが、顧客（新製品の採用）が動かず、業務プロセスで止まっている。
- 予防保守サービス事業（新規）：故障予知のPoCから始め、途中で顧客ポータルにも着手。業務プロセスまで来た。
"""

from __future__ import annotations

from datetime import date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import models as m
from . import strategy
from .schemas import InitiativeProgressIn, ObjectiveProgressIn, VersionIn

# 四半期ごとの目標の値（左から：1つ目の版、2つ目、3つ目、4つ目、今）。None はその時点では入れない
OBJ_STEPS: dict[str, list[str | None]] = {
    # 全社
    "cfin": ["192億円", "198億円", "205億円", "214億円", "221億円"],
    # 産業機器事業：テーマ1（保守を止めない）
    "b1lg1": ["94%", "96%", "98%", None, None],
    "b1pr1": [None, "月48件", "月53件", "月57件", "月59件"],
    "b1pr2": [None, None, "20件", "45件", "70件"],
    "b1cu1": [None, None, "86%", "88%", "89%"],
    "b1fi1": [None, None, None, "1,265億円", "1,290億円"],
    # 産業機器事業：テーマ2（段取り替えを短く）
    "b1lg2": ["42%", "50%", "58%", "66%", "72%"],
    "b1lg3": [None, "52%", "60%", "66%", "70%"],
    "b1pr3": [None, None, "35分", "32分", "30分"],
    "b1fi2": [None, None, None, None, "66.2%"],
    # 計測機器事業：業務までは動くが、顧客が動かない
    "b2lg1": ["15人", "19人", "22人", "25人", "27人"],
    "b2lg2": [None, "90台", "160台", "230台", "280台"],
    "b2lg3": [None, "月8件", "月11件", "月13件", "月14件"],
    "b2pr1": [None, None, "20か月", "19か月", "18か月"],
    # 予防保守サービス事業（新規）
    "b3lg1": [None, "75%", "78%", "81%", "83%"],
    "b3pr1": [None, None, None, "8%", "18%"],
}

# 施策の進捗：(何番目の時点から, 効果の検証, 施策の指標の今の値, 実行条件, 検証日, やったこと, 結果)
# 効果の検証：0＝未測定、1＝確認中、2＝効果あり、3＝効果なし
INIT_STEPS: dict[str, list[tuple[int, int, str, bool, bool, str, str]]] = {
    "i9": [
        (0, 1, "2", True, True, "産業機器の稼働データを基盤に載せた", "保守部門が稼働状況を見られるようになった"),
        (2, 1, "3", True, True, "計測機器の検査データも基盤に載せた", "2事業のデータを同じ形で扱えるようになった"),
    ],
    "i1": [
        (0, 1, "2,200台", True, True, "主要顧客の設備から連携を始めた", "欠損が減り始めた"),
        (2, 2, "2,900台", True, True, "連携の対象を全顧客に広げた", "必要な稼働データの欠損なし率が目標に届いた"),
    ],
    "i2": [
        (1, 1, "35%", True, True, "稼働状況に応じた提案ルールを試行", "提案件数が増え始めた"),
        (3, 2, "72%", True, True, "全営業所に展開した", "提案件数と保守契約の継続率がともに上がった"),
    ],
    "i3": [
        (2, 1, "1件", True, False, "予防型メニューの1つ目を設計した", "既存顧客20社に案内した"),
        (4, 1, "2件", True, False, "2つ目のメニューを追加した", "契約数は伸びているが、継続率への効果はまだ確認中"),
    ],
    "i4": [
        (0, 1, "8", True, True, "組立工程の一部で自動収集を始めた", "手入力の工程が減った"),
        (3, 2, "13", True, True, "残りの工程にも広げた", "段取り替えの時間の分析に使えるようになった"),
    ],
    "i5": [
        (1, 1, "45%", True, False, "標準手順を作って教育を始めた", "習熟にばらつきがある"),
        (3, 1, "70%", True, True, "教育を全ラインに広げた", "段取り替えの時間が短くなってきた"),
    ],
    "i7": [
        (0, 1, "34人", True, True, "解析研修の第1期を実施", "受講者が解析を始めた"),
        (2, 2, "52人", True, True, "第2期まで実施", "解析できる技術者が増えた"),
    ],
    "i6": [
        (2, 1, "6件", False, True, "AI解析で検査データの改良点を探した", "開発期間は短くなったが、新製品の採用はまだ動いていない"),
        (4, 1, "8件", True, False, "改良点を次の製品に反映中", "顧客への提案はこれから"),
    ],
    "i8": [
        (1, 1, "55%", True, True, "故障予知モデルのPoCを開始", "的中率が上がり始めた"),
        (3, 1, "68%", False, True, "対象の設備を増やした", "予知に基づく訪問を試行できる精度になった"),
    ],
    "i11": [
        (3, 1, "6社", False, True, "顧客ポータルを試験公開した", "予知に基づく訪問の案内に使い始めた"),
    ],
}

AUTHOR = {"b1": "産業機器事業部", "b2": "計測機器事業部", "b3": "新事業推進室", "cf": "経営企画部"}
INIT_AUTHOR = "DX推進部"


def _quarter_ends(today: date, n: int) -> list[date]:
    """今日の少なくとも1週間前までの、直近 n 個の四半期末（古い順）"""
    ends = []
    y = today.year
    cands = []
    for yy in (y - 2, y - 1, y):
        for mm, dd in ((3, 31), (6, 30), (9, 30), (12, 31)):
            cands.append(date(yy, mm, dd))
    for d in cands:
        if d <= today - timedelta(days=7):
            ends.append(d)
    return ends[-n:]


def _at(d: date) -> datetime:
    return datetime(d.year, d.month, d.day, 17, 30)


def build(s: Session, cid: int) -> None:
    """作成中の申請（入力済み）から、申請・進捗・版の入った状態を作る"""
    today = strategy.now().date()
    qs = _quarter_ends(today, 4)
    applied = qs[0] - timedelta(days=60)  # 1つ目の四半期末の約2か月前に申請した
    moments = qs + [today]

    strategy.create_application(s, cid)
    app = strategy.current_application(s, cid)
    if app is None:
        return
    # 申請と作成時点の版を、申請した日にさかのぼらせる
    app.submitted_at = _at(applied)
    for v in s.scalars(select(m.MapVersion).where(m.MapVersion.application_id == app.id)):
        v.as_of, v.created_at = applied, _at(applied)
    s.flush()

    for k, when in enumerate(moments):
        for oid, vals in OBJ_STEPS.items():
            v = vals[k]
            if v is None:
                continue
            strategy.save_objective_progress(
                s,
                cid,
                oid,
                ObjectiveProgressIn(value=v, at=when, author=AUTHOR.get(oid[:2], "経営企画部")),
            )
        touched: set[str] = set()
        for iid, steps in INIT_STEPS.items():
            for start, verify, cur, cond, review, did, result in steps:
                if start == k:
                    touched.add(iid)
                    strategy.save_initiative_progress(
                        s,
                        cid,
                        iid,
                        InitiativeProgressIn(
                            verify=verify,
                            kpiCur=cur,
                            did=did,
                            result=result,
                            author=INIT_AUTHOR,
                            condition=cond,
                            review=review,
                        ),
                    )
        # 入力した日時を、その時点にそろえる
        for row in s.scalars(select(m.ObjectiveProgress).where(m.ObjectiveProgress.company_id == cid)):
            if row.at == when:
                row.updated_at = _at(when)
        for row in s.scalars(select(m.InitiativeProgress).where(m.InitiativeProgress.company_id == cid)):
            if row.initiative_id in touched:
                row.updated_at = _at(when)
        s.flush()
        if when != today:
            label = f"{when.year}年{when.month}月末"
            strategy.create_version(s, cid, VersionIn(label=label, asOf=when, createdBy="経営企画部"))
            v = s.scalars(
                select(m.MapVersion).where(m.MapVersion.application_id == app.id, m.MapVersion.label == label)
            ).first()
            if v is not None:
                v.created_at = _at(when)
    s.flush()
