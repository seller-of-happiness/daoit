import { IHospitalSkeleton } from '@/refactoring/modules/apiStore/types/hospital-skeleton/IHospitalSkeleton'

export function getLocationPath(
    locationData: {
        location?: string | null;
        block?: { id: string } | null;
        floor?: { id: string } | null;
        room?: { id: string } | null;
    },
    hospitals: IHospitalSkeleton[],
    options: {
        manualText?: string; // Текст для ручного ввода
        includeHospital?: boolean; // Включать название больницы
    } = {
        manualText: 'Место указано вручную',
        includeHospital: true
    }
): string | null {
    const { location, block, floor, room } = locationData;
    const { manualText, includeHospital } = options;

    if (location?.trim()) return manualText || null;
    if (!Array.isArray(hospitals) || hospitals.length === 0) return null;
    if (!block?.id && !floor?.id && !room?.id) return null;

    for (const hospital of hospitals) {
        const selectedBlock = hospital.blocks.find(b => b.id === block?.id);
        if (!selectedBlock) continue;

        const pathParts: string[] = [];
        if (includeHospital) pathParts.push(hospital.name);
        pathParts.push(selectedBlock.name);

        if (floor?.id) {
            const selectedFloor = selectedBlock.floors.find(f => f.id === floor.id);
            if (selectedFloor) {
                pathParts.push(`Этаж ${selectedFloor.number ?? selectedFloor.name}`);

                if (room?.id) {
                    const selectedRoom = selectedFloor.rooms.find(r => r.id === room.id);
                    if (selectedRoom) {
                        pathParts.push(
                            selectedRoom.name || `помещение ${selectedRoom.number || ''}`
                        );
                    }
                }
            }
        }

        return pathParts.join(', ');
    }

    return null;
}
