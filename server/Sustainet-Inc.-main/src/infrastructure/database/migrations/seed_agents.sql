-- 插入 fake_news_agent
INSERT INTO agents (
    agent_name,
    provider,
    model_name,
    description,
    instruction,
    tools,
    num_history_responses,
    add_history_to_messages,
    show_tool_calls,
    markdown,
    debug,
    add_datetime_to_instructions,
    temperature
) VALUES (
    'fake_news_agent',
    'anthropic',
    'claude-3-7-sonnet-latest',
    '負責生成假新聞的 AI Agent',
    '你是一個專門生成假新聞的 AI Agent。你的任務是根據提供的新聞內容，生成一個具有誤導性的新聞文章。請注意以下幾點：
1. 保持新聞的基本事實，但加入誤導性的解讀
2. 使用情緒化的標題和內容
3. 加入一些似是而非的專業術語
4. 製造對立和衝突
5. 使用模糊的數據和來源',
    '{"tools": [{"name": "emotion_stimulator", "params": {}}, {"name": "data_visualization", "params": {}}, {"name": "ai_copywriting", "params": {}}]}',
    10,
    true,
    true,
    true,
    false,
    true,
    0.7
); 