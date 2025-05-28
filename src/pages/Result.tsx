type ResultProps = {
  resultText: string;
  playerScore: number;
  agentScore: number;
  onRestart: () => void;
};

export default function Result({
  resultText,
  playerScore,
  agentScore,
  onRestart,
}: ResultProps) {
  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col justify-center items-center space-y-6 p-6">
      <h1 className="text-3xl font-bold">🎉 結算結果</h1>

      <p className="text-xl text-center">{resultText}</p>

      <div className="text-lg text-gray-300">
        <p>你的信任分數：<span className="text-white font-semibold">{playerScore}</span></p>
        <p>AI 的信任分數：<span className="text-white font-semibold">{agentScore}</span></p>
      </div>

      <button
        onClick={onRestart}
        className="mt-4 bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded text-lg"
      >
        🔁 再玩一次
      </button>
    </div>
  );
}