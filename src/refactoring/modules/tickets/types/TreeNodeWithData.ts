import { ITreeNode } from '@/refactoring/modules/apiStore/types/ITreeNode'

export type TreeNodeWithData = ITreeNode & { data?: { selfId?: string }, children?: TreeNodeWithData[] }
