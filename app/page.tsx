import UploadZone from '@/components/UploadZone';

export default function Home() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-2xl text-center mb-10">
        <h1 className="text-4xl font-bold text-gray-900 mb-4 tracking-tight">
          Understand any contract before you sign
        </h1>
        <p className="text-lg text-gray-500">
          Upload a PDF and get clause-by-clause risk analysis, plain-English summaries,
          and market-standard comparisons — in minutes.
        </p>
      </div>
      <UploadZone />
    </div>
  );
}
