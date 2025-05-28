"""add available_from_round 

Revision ID: 3e3973af9d66
Revises: d703abc30de2
Create Date: 2025-05-23 11:33:10.741903

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3e3973af9d66'
down_revision: Union[str, None] = 'd703abc30de2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 添加 available_from_round 欄位
    op.add_column('tools', sa.Column('available_from_round', sa.Integer(), nullable=False, server_default=sa.text('1')))
    
    # 插入初始工具數據
    op.bulk_insert(
        sa.table('tools',
            sa.column('tool_name', sa.String),
            sa.column('description', sa.Text),
            sa.column('trust_effect', sa.Float),
            sa.column('spread_effect', sa.Float),
            sa.column('applicable_to', sa.String),
            sa.column('available_from_round', sa.Integer)
        ),
        [
            {
                'tool_name': '事實查核',
                'description': '對新聞內容進行事實查核，提高可信度',
                'trust_effect': 1.2,
                'spread_effect': 0.9,
                'applicable_to': 'player',
                'available_from_round': 1
            },
            {
                'tool_name': '情緒分析',
                'description': '分析新聞內容的情緒傾向，調整傳播效果',
                'trust_effect': 0.9,
                'spread_effect': 1.3,
                'applicable_to': 'player',
                'available_from_round': 1
            },
            {
                'tool_name': '來源驗證',
                'description': '驗證新聞來源的可信度',
                'trust_effect': 1.1,
                'spread_effect': 1.1,
                'applicable_to': 'player',
                'available_from_round': 1
            },
            {
                'tool_name': 'AI文案優化',
                'description': '使用AI優化新聞文案，提高傳播效果',
                'trust_effect': 1.0,
                'spread_effect': 1.2,
                'applicable_to': 'player',
                'available_from_round': 2
            },
            {
                'tool_name': '數據視覺化',
                'description': '將數據轉換為視覺化圖表，提高可信度',
                'trust_effect': 1.3,
                'spread_effect': 1.0,
                'applicable_to': 'player',
                'available_from_round': 2
            },
            {
                'tool_name': '社群互動',
                'description': '增加與讀者的互動，提高傳播效果',
                'trust_effect': 1.0,
                'spread_effect': 1.4,
                'applicable_to': 'player',
                'available_from_round': 3
            }
        ]
    )


def downgrade() -> None:
    """Downgrade schema."""
    # 刪除工具數據
    op.execute("DELETE FROM tools")
    # 刪除欄位
    op.drop_column('tools', 'available_from_round')
