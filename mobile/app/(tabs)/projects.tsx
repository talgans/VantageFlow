import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Project, TaskStatus, UserRole } from '../../types';
import { subscribeToUserProjects } from '../../services/firestoreService';
import { colors, typography, spacing, borderRadius } from '../../constants/theme';
import { Card } from '../../components/ui/Card';
import { CircularProgress } from '../../components/ui/CircularProgress';
import { Search, Calendar, Users, DollarSign, Layers } from 'lucide-react-native';

export default function ProjectsScreen() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'archived'>('active');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToUserProjects(
      user.uid,
      user.role === UserRole.Admin,
      (updated) => setProjects(updated)
    );
    return () => unsubscribe();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  const filteredProjects = projects.filter((p) => {
    // Status filter
    if (filter === 'active' && p.isArchived) return false;
    if (filter === 'archived' && !p.isArchived) return false;

    // Search query
    if (search) {
      const q = search.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchCore = p.coreSystem.toLowerCase().includes(q);
      return matchName || matchCore;
    }
    return true;
  });

  return (
    <View style={styles.container}>
      {/* Search Input Bar */}
      <View style={styles.searchBarWrap}>
        <View style={styles.searchBar}>
          <Search size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search projects or systems..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* Filter Chips */}
        <View style={styles.filterChipsRow}>
          {(['active', 'all', 'archived'] as const).map((tab) => {
            const isSelected = filter === tab;
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setFilter(tab)}
                style={[styles.filterChip, isSelected && styles.filterChipActive]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isSelected && styles.filterChipTextActive,
                  ]}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Projects List */}
      <ScrollView
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {filteredProjects.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No Projects Found</Text>
            <Text style={styles.emptySub}>
              Try adjusting your search criteria or switch to another filter.
            </Text>
          </View>
        ) : (
          filteredProjects.map((proj) => {
            let totalTasks = 0;
            let doneTasks = 0;
            proj.phases.forEach((ph) => {
              ph.tasks.forEach((t) => {
                totalTasks++;
                if (t.status === TaskStatus.Hundred) doneTasks++;
              });
            });
            const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

            return (
              <Card
                key={proj.id}
                style={styles.projectCard}
                onPress={() => router.push(`/project/${proj.id}`)}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={styles.projTitle}>{proj.name}</Text>
                    <Text style={styles.projCore} numberOfLines={1}>
                      {proj.coreSystem}
                    </Text>
                  </View>
                  <CircularProgress percentage={progress} size={46} strokeWidth={4} />
                </View>

                {/* Metadata Pills */}
                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <Calendar size={13} color={colors.textSecondary} />
                    <Text style={styles.metaText}>
                      {proj.duration} {proj.durationUnit}
                    </Text>
                  </View>

                  <View style={styles.metaItem}>
                    <Layers size={13} color={colors.textSecondary} />
                    <Text style={styles.metaText}>{proj.phases.length} Phases</Text>
                  </View>

                  <View style={styles.metaItem}>
                    <Users size={13} color={colors.textSecondary} />
                    <Text style={styles.metaText}>
                      {proj.team.members.length} Members
                    </Text>
                  </View>
                </View>

                {/* Budget */}
                {proj.cost > 0 && (
                  <View style={styles.budgetRow}>
                    <Text style={styles.budgetText}>
                      Budget: {proj.currency} {proj.cost.toLocaleString()}
                    </Text>
                  </View>
                )}
              </Card>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchBarWrap: {
    padding: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: typography.sizes.sm,
  },
  filterChipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    backgroundColor: colors.cardSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  filterChipTextActive: {
    color: colors.background,
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  emptySub: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: spacing.xl,
  },
  projectCard: {
    padding: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  projTitle: {
    color: colors.text,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    marginBottom: 2,
  },
  projCore: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: spacing.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
  },
  budgetRow: {
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  budgetText: {
    color: colors.success,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
});
