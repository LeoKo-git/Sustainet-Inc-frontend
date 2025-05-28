type ToolCardProps = {
  name: string;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
};

export default function ToolCard({ name, selected, disabled, onClick }: ToolCardProps) {
  return (
    <button
      className={`border rounded px-4 py-2 text-sm md:text-base w-40 transition
        ${selected ? 'bg-blue-500 text-white' : 'bg-white text-black'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-100'}`}
      onClick={onClick}
      disabled={disabled}
    >
      {name}
    </button>
  );
}