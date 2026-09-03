import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  X,
  Calendar,
  CheckSquare,
  Square,
  Camera,
  Image as ImageIcon,
  Users,
  Flag,
  Sparkles,
} from 'lucide-react-native';
import { Task, TaskStatus, TaskPriority, TeamMember } from '../../types';
import { colors, typography, spacing, borderRadius } from '../../constants/theme';
import { StatusBadge } from '../ui/StatusBadge';
import { PriorityBadge } from '../ui/PriorityBadge';
import { pickAndUploadTaskImage } from '../../services/storageService';

interface TaskDetailModalProps {
  visible: boolean;
  task: Task | null;
  projectId: string;
  onClose: () => void;
  onUpdateTask: (updatedTask: Task) => void;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  visible,
  task,
  projectId,
  onClose,
  onUpdateTask,
}) => {
  if (!task) return null;

  const [currentTask, setCurrentTask] = useState<Task>(task);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Sync state when task prop changes
  React.useEffect(() => {
    if (task) setCurrentTask(task);
  }, [task]);

  const allStatuses = [
    TaskStatus.Zero,
    TaskStatus.TwentyFive,
    TaskStatus.Fifty,
    TaskStatus.SeventyFive,
    TaskStatus.Hundred,
    TaskStatus.AtRisk,
  ];

  const handleStatusChange = (newStatus: TaskStatus) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const updated = { ...currentTask, status: newStatus };
    setCurrentTask(updated);
    onUpdateTask(updated);
  };

  const handlePriorityChange = (newPriority: TaskPriority) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = { ...currentTask, priority: newPriority };
    setCurrentTask(updated);
    onUpdateTask(updated);
  };

  const handleToggleDeliverable = (index: number) => {
    Haptics.selectionAsync();
    const deliverables = [...(currentTask.deliverables || [])];
    const item = deliverables[index];
    // Prefix completed deliverable with [x]
    if (item.startsWith('[x] ')) {
      deliverables[index] = item.replace('[x] ', '');
    } else {
      deliverables[index] = `[x] ${item}`;
    }
    const updated = { ...currentTask, deliverables };
    setCurrentTask(updated);
    onUpdateTask(updated);
  };

  const handleAddImage = async (source: 'camera' | 'library') => {
    try {
      setUploadingImage(true);
      const downloadUrl = await pickAndUploadTaskImage(projectId, currentTask.id, source);
      if (downloadUrl) {
        const imageUrls = [...(currentTask.imageUrls || []), downloadUrl];
        const updated = { ...currentTask, imageUrls };
        setCurrentTask(updated);
        onUpdateTask(updated);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message || 'Could not upload image.');
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={2}>
                {currentTask.name}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Status Selector Bar */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Status</Text>
              <View style={styles.statusChipsContainer}>
                {allStatuses.map((s) => {
                  const isSelected = currentTask.status === s;
                  return (
                    <TouchableOpacity
                      key={s}
                      onPress={() => handleStatusChange(s)}
                      style={[
                        styles.statusChip,
                        isSelected && styles.statusChipActive,
                      ]}
                    >
                      <StatusBadge status={s} size="sm" />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* VantageFlow Priority Rubric */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Priority Rubric</Text>
              <View style={styles.priorityRow}>
                {[TaskPriority.Critical, TaskPriority.Important, TaskPriority.Enhancement].map((p) => {
                  const isSelected = (currentTask.priority ?? TaskPriority.Important) === p;
                  return (
                    <TouchableOpacity
                      key={p}
                      onPress={() => handlePriorityChange(p)}
                      style={[
                        styles.priorityChip,
                        isSelected && styles.priorityChipActive,
                      ]}
                    >
                      <PriorityBadge priority={p} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Date Range */}
            <View style={styles.infoRow}>
              <Calendar size={16} color={colors.primary} />
              <Text style={styles.infoText}>
                {new Date(currentTask.startDate).toLocaleDateString()} —{' '}
                {new Date(currentTask.endDate).toLocaleDateString()}
              </Text>
            </View>

            {/* Assignees */}
            <View style={styles.section}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Users size={16} color={colors.primary} />
                <Text style={styles.sectionLabel}>Assignees</Text>
              </View>
              {currentTask.assignees && currentTask.assignees.length > 0 ? (
                <View style={styles.assigneesWrap}>
                  {currentTask.assignees.map((a) => (
                    <View key={a.uid} style={styles.assigneePill}>
                      <Text style={styles.assigneeName}>{a.displayName || a.email}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyText}>No assignees assigned</Text>
              )}
            </View>

            {/* Deliverables Checklist */}
            {currentTask.deliverables && currentTask.deliverables.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Deliverables</Text>
                {currentTask.deliverables.map((item, idx) => {
                  const isChecked = item.startsWith('[x] ');
                  const label = isChecked ? item.replace('[x] ', '') : item;
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={styles.deliverableItem}
                      onPress={() => handleToggleDeliverable(idx)}
                      activeOpacity={0.7}
                    >
                      {isChecked ? (
                        <CheckSquare size={18} color={colors.success} />
                      ) : (
                        <Square size={18} color={colors.textMuted} />
                      )}
                      <Text
                        style={[
                          styles.deliverableText,
                          isChecked && styles.deliverableTextChecked,
                        ]}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Image Attachments */}
            <View style={styles.section}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={styles.sectionLabel}>Deliverable Photos</Text>
                <View style={styles.photoActions}>
                  <TouchableOpacity
                    onPress={() => handleAddImage('camera')}
                    style={styles.iconBtn}
                    disabled={uploadingImage}
                  >
                    <Camera size={18} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleAddImage('library')}
                    style={styles.iconBtn}
                    disabled={uploadingImage}
                  >
                    <ImageIcon size={18} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>

              {uploadingImage && (
                <View style={styles.uploadingBox}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={styles.uploadingText}>Uploading deliverable photo...</Text>
                </View>
              )}

              {currentTask.imageUrls && currentTask.imageUrls.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageGallery}>
                  {currentTask.imageUrls.map((url, i) => (
                    <Image key={i} source={{ uri: url }} style={styles.taskThumbnail} />
                  ))}
                </ScrollView>
              ) : (
                <Text style={styles.emptyText}>No photos attached yet</Text>
              )}
            </View>

            {/* Subtasks */}
            {currentTask.subTasks && currentTask.subTasks.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Subtasks ({currentTask.subTasks.length})</Text>
                {currentTask.subTasks.map((sub) => (
                  <View key={sub.id} style={styles.subtaskRow}>
                    <Text style={styles.subtaskName}>{sub.name}</Text>
                    <StatusBadge status={sub.status} size="sm" />
                  </View>
                ))}
              </View>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: colors.card,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '85%',
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    color: colors.text,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  content: {
    marginTop: spacing.md,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  statusChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  statusChip: {
    padding: 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  statusChipActive: {
    borderColor: colors.primary,
    transform: [{ scale: 1.05 }],
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  priorityChip: {
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  priorityChipActive: {
    borderColor: colors.primary,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.inputBg,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  infoText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
  },
  assigneesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  assigneePill: {
    backgroundColor: colors.cardSecondary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  assigneeName: {
    color: colors.text,
    fontSize: typography.sizes.xs,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: typography.sizes.sm,
    fontStyle: 'italic',
  },
  deliverableItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  deliverableText: {
    color: colors.text,
    fontSize: typography.sizes.sm,
    flex: 1,
  },
  deliverableTextChecked: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  photoActions: {
    flexDirection: 'row',
    gap: 10,
  },
  iconBtn: {
    backgroundColor: colors.cardSecondary,
    padding: 6,
    borderRadius: borderRadius.md,
  },
  uploadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: spacing.sm,
  },
  uploadingText: {
    color: colors.primary,
    fontSize: typography.sizes.xs,
  },
  imageGallery: {
    marginTop: 6,
  },
  taskThumbnail: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.md,
    marginRight: 8,
    backgroundColor: colors.cardSecondary,
  },
  subtaskRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: 6,
  },
  subtaskName: {
    color: colors.text,
    fontSize: typography.sizes.sm,
    flex: 1,
    marginRight: 8,
  },
});
