import TetrisLoading from "@/components/ui/tetris-loader";

export default function DashboardLoading() {
    return (
        <div className="flex h-full w-full items-center justify-center min-h-[50vh]">
            <TetrisLoading size="md" speed="normal" loadingText="Cargando..." />
        </div>
    );
}
