import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Project, Task, TaskStatus, TaskPriority, UserRole } from '../../types';
import { subscribeToUserProjects, updateProject } from '../../services/firestoreService';
import { colors, typography, spacing, borderRadius } from '../../constants/theme';
import { Card } from '../../components/ui/Card';
import { CircularProgress } from '../../components/ui/CircularProgress';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PriorityBadge } from '../../components/ui/PriorityBadge';
import { MilestoneTimeline } from '../../components/timeline/MilestoneTimeline';
import { TaskDetailModal } from '../../components/sheets/TaskDetailModal';
import {
  Calendar,
  DollarSign,
  Users,
  MessageCircle,
  Clock,
  Layers,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'timeline' | 'tasks' | 'team'>('timeline');
  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToUserProjects(
      user.uid,
      user.role === UserRole.Admin,
      (projects) => {
        const found = projects.find((p) => p.id === id);
        if (found) setProject(found);
      }
    );
    return () => unsubscribe();
  }, [user, id]);

  if (!project) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading project details...</Text>
      </View>
    );
  }

  // Calculate overall project stats
  let totalTasks = 0;
  let doneTasks = 0;
  let atRiskTasks = 0;
  project.phases.forEach((ph) => {
    ph.tasks.forEach((t) => {
      totalTasks++;
      if (t.status === TaskStatus.Hundred) doneTasks++;
      if (t.status === TaskStatus.AtRisk) atRiskTasks++;
    });
  });
  const progressPercent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const togglePhase = (phaseId: string) => {
    setExpandedPhases((prev) => ({
      ...prev,
      [phaseId]: !prev[phaseId],
    }));
  };

  const handleOpenTask = (task: Task) => {
    setSelectedTask(task);
    setIsTaskModalOpen(true);
  };

  const handleUpdateTask = async (updatedTask: Task) => {
    if (!project) return;
    const updatedPhases = project.phases.map((phase) => ({
      ...phase,
      tasks: phase.tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t)),
    }));

    const updatedProject = { ...project, phases: updatedPhases };
    setProject(updatedProject);
    setSelectedTask(updatedTask);

    try {
      await updateProject(updatedProject);
    } catch (err) {
      console.error('Failed to sync project task to Firestore:', err);
    }
  };

  const handleOpenWhatsApp = (phoneNumber?: string) => {
    if (!phoneNumber) return;
    const cleaned = phoneNumber.replace(/[^0-9]/g, '');
    Linking.openURL(`whatsapp://send?phone=${cleaned}`).catch(() => {
      Linking.openURL(`https://wa.me/${cleaned}`);
    });
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: project.name,
          headerBackTitle: 'Projects',
        }}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Project Header Card */}
        <Card style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View style={{ flex: 1, marginRight: 16 }}>
              <Text style={styles.projTitle}>{project.name}</Text>
              <Text style={styles.projCore}>{project.coreSystem}</Text>
            </View>
            <CircularProgress percentage={progressPercent} size={54} strokeWidth={4.5} />
          </View>

          <Text style={styles.projDesc}>{project.description}</Text>

          {/* Quick Info Grid */}
          <View style={styles.infoGrid}>
            <View style={styles.infoPill}>
              <Clock size={13} color={colors.primary} />
              <Text style={styles.infoPillText}>
                {project.duration} {project.durationUnit}
              </Text>
            </View>
            <View style={styles.infoPill}>
              <Layers size={13} color={colors.primary} />
              <Text style={styles.infoPillText}>{project.phases.length} Phases</Text>
            </View>
            <View style={styles.infoPill}>
              <Users size={13} color={colors.primary} />
              <Text style={styles.infoPillText}>
                {project.team.members.length} Members
              </Text>
            </View>
          </View>
        </Card>

        {/* Tab Navigation Segment */}
        <View style={styles.tabSegment}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'timeline' && styles.tabBtnActive]}
            onPress={() => setActiveTab('timeline')}
          >
            <Text
              style={[
                styles.tabBtnText,
                activeTab === 'timeline' && styles.tabBtnTextActive,
              ]}
            >
              Timeline
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'tasks' && styles.tabBtnActive]}
            onPress={() => setActiveTab('tasks')}
          >
            <Text
              style={[styles.tabBtnText, activeTab === 'tasks' && styles.tabBtnTextActive]}
            >
              Tasks ({totalTasks})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'team' && styles.tabBtnActive]}
            onPress={() => setActiveTab('team')}
          >
            <Text
              style={[styles.tabBtnText, activeTab === 'team' && styles.tabBtnTextActive]}
            >
              Team ({project.team.members.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* TAB 1: Milestone / Agenda Timeline */}
        {activeTab === 'timeline' && (
          <MilestoneTimeline project={project} onSelectTask={handleOpenTask} />
        )}

        {/* TAB 2: Phase & Tasks List */}
        {activeTab === 'tasks' && (
          <View style={styles.phaseListWrap}>
            {project.phases.map((phase) => {
              const isExpanded = expandedPhases[phase.id] !== false; // default expanded
              return (
                <View key={phase.id} style={styles.phaseCard}>
                  <TouchableOpacity
                    style={styles.phaseHeader}
                    onPress={() => togglePhase(phase.id)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.phaseTitle}>{phase.name}</Text>
                      <Text style={styles.phaseSub}>{phase.weekRange}</Text>
                    </View>
                    {isExpanded ? (
                      <ChevronUp size={20} color={colors.textMuted} />
                    ) : (
                      <ChevronDown size={20} color={colors.textMuted} />
                    )}
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.phaseTasks}>
                      {phase.tasks.map((task) => (
                        <TouchableOpacity
                          key={task.id}
                          style={styles.taskItem}
                          onPress={() => handleOpenTask(task)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.taskHeaderRow}>
                            <Text style={styles.taskTitle} numberOfLines={2}>
                              {task.name}
                            </Text>
                          </View>
                          <View style={styles.taskMetaRow}>
                            <StatusBadge status={task.status} size="sm" />
                            {task.priority && (
                              <PriorityBadge priority={task.priority} />
                            )}
                            <Text style={styles.taskDates}>
                              {new Date(task.startDate).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* TAB 3: Team Directory with Direct WhatsApp Chat */}
        {activeTab === 'team' && (
          <View style={styles.teamWrap}>
            {project.team.members.map((member) => (
              <Card key={member.uid} style={styles.memberCard}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberAvatarText}>
                    {(member.displayName || member.email).substring(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.memberNameText}>
                      {member.displayName || member.email}
                    </Text>
                    {member.leadRole && (
                      <View style={styles.leadRolePill}>
                        <Text style={styles.leadRoleText}>{member.leadRole}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.memberEmailText}>{member.email}</Text>
                </View>

                {member.phoneNumber && (
                  <TouchableOpacity
                    style={styles.whatsappBtn}
                    onPress={() => handleOpenWhatsApp(member.phoneNumber)}
                  >
                    <MessageCircle size={18} color="#25D366" />
                  </TouchableOpacity>
                )}
              </Card>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Task Detail Interactive Modal */}
      <TaskDetailModal
        visible={isTaskModalOpen}
        task={selectedTask}
        projectId={project.id}
        onClose={() => setIsTaskModalOpen(false)}
        onUpdateTask={handleUpdateTask}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingWrap: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    marginTop: 12,
  },
  content: {
    padding: spacing.lg,
  },
  headerCard: {
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  projTitle: {
    color: colors.text,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  projCore: {
    color: colors.primary,
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  projDesc: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.inputBg,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.md,
  },
  infoPillText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
  },
  tabSegment: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: 4,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: borderRadius.md,
  },
  tabBtnActive: {
    backgroundColor: colors.primary,
  },
  tabBtnText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  tabBtnTextActive: {
    color: colors.background,
    fontWeight: typography.weights.bold,
  },
  phaseListWrap: {
    gap: spacing.md,
  },
  phaseCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  phaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: colors.cardSecondary,
  },
  phaseTitle: {
    color: colors.text,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
  },
  phaseSub: {
    color: colors.primary,
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  phaseTasks: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  taskItem: {
    backgroundColor: colors.inputBg,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  taskHeaderRow: {
    marginBottom: spacing.xs,
  },
  taskTitle: {
    color: colors.text,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  taskMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  taskDates: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
    marginLeft: 'auto',
  },
  teamWrap: {
    gap: spacing.md,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarText: {
    color: colors.primary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  memberNameText: {
    color: colors.text,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
  },
  memberEmailText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  leadRolePill: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  leadRoleText: {
    color: colors.secondary,
    fontSize: 10,
    fontWeight: typography.weights.semibold,
    textTransform: 'uppercase',
  },
  whatsappBtn: {
    backgroundColor: 'rgba(37, 211, 102, 0.15)',
    padding: 10,
    borderRadius: 20,
  },
});
