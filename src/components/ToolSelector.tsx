import { useState } from 'react';
import ToolCard from './ToolCard';

type ToolSelectorProps = {
  availableTools: string[];
  onUseTool: (tools: string[]) => void;
};

export default function ToolSelector({ availableTools, onUseTool }: ToolSelectorProps) {
  const [selected, setSelected] = useState<string[]>([]);

  const toggleTool = (tool: string) => {
    if (selected.includes(tool)) {
      setSelected(selected.filter(t => t !== tool));
    } else if (selected.length < 3) {
      setSelected([...selected, tool]);
    }
  };

  const handleSubmit = () => {
    onUseTool(selected);
    setSelected([]);
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="flex flex-wrap justify-center gap-4">
        {availableTools.map(tool => (
          <ToolCard
            key={tool}
            name={tool}
            selected={selected.includes(tool)}
            disabled={!selected.includes(tool) && selected.length >= 3}
            onClick={() => toggleTool(tool)}
          />
        ))}
      </div>
      <button
        onClick={handleSubmit}
        className="mt-4 bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded disabled:opacity-50"
        disabled={selected.length === 0}
      >
        🚀 使用選擇的工具
      </button>
    </div>
  );
}