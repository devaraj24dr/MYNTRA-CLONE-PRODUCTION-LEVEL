import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import {
  ChevronLeft,
  Search,
  Download,
  Share2,
  Filter,
  ArrowUpDown,
  CreditCard,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileSpreadsheet,
} from "lucide-react-native";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import axios from "axios";
import API_URL from "@/constants/Api";

interface Transaction {
  _id: string;
  transactionId: string;
  invoiceId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  status: "pending" | "success" | "failed" | "refunded";
  description: string;
  createdAt: string;
}

export default function TransactionsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { user } = useAuth();

  // State Management
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Fetch transactions from server
  const fetchTransactions = useCallback(
    async (pageNum: number, isNewSearch = false) => {
      if (!user?._id) return;
      if (pageNum > 1 && pageNum > totalPages && !isNewSearch) return;

      if (pageNum === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const response = await axios.get(`${API_URL}/transactions`, {
          params: {
            userId: user._id,
            page: pageNum,
            limit: 10,
            status: statusFilter,
            paymentMethod: methodFilter,
            search: searchQuery,
            sortBy: sortBy,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
          },
        });

        if (response.data.success) {
          const fetched = response.data.transactions;
          if (pageNum === 1) {
            setTransactions(fetched);
          } else {
            setTransactions((prev) => [...prev, ...fetched]);
          }
          setPage(response.data.page);
          setTotalPages(response.data.totalPages);
          setTotalCount(response.data.totalCount);
        }
      } catch (error) {
        console.error("Failed to load transactions:", error);
        Alert.alert("Error", "Could not fetch transactions list.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [user?._id, statusFilter, methodFilter, searchQuery, sortBy, startDate, endDate, totalPages]
  );

  // Refresh list when filter changes
  useEffect(() => {
    fetchTransactions(1, true);
  }, [statusFilter, methodFilter, sortBy, startDate, endDate]);

  const handleSearchSubmit = () => {
    fetchTransactions(1, true);
  };

  const loadMore = () => {
    if (!loading && !loadingMore && page < totalPages) {
      fetchTransactions(page + 1);
    }
  };

  // Download PDF Receipt
  const handleDownloadReceipt = async (item: Transaction) => {
    try {
      setDownloadingId(item._id);
      const downloadUrl = `${API_URL}/transactions/${item._id}/receipt`;

      if (Platform.OS === "web") {
        window.open(downloadUrl, "_blank");
        return;
      }

      const fileUri = `${FileSystem.documentDirectory}receipt_${item.invoiceId}.pdf`;
      const downloadResult = await FileSystem.downloadAsync(downloadUrl, fileUri);

      if (downloadResult.status === 200) {
        await Sharing.shareAsync(downloadResult.uri, {
          mimeType: "application/pdf",
          dialogTitle: `Receipt ${item.invoiceId}`,
          UTI: "com.adobe.pdf",
        });
      } else {
        Alert.alert("Error", "Failed to download receipt.");
      }
    } catch (error) {
      console.error("Receipt download error:", error);
      Alert.alert("Error", "Could not fetch receipt PDF.");
    } finally {
      setDownloadingId(null);
    }
  };

  // Export CSV
  const handleExportCSV = async () => {
    if (!user?._id) return;
    try {
      setExporting(true);
      const queryParams = new URLSearchParams({
        userId: user._id,
        status: statusFilter,
        paymentMethod: methodFilter,
        search: searchQuery,
        sortBy: sortBy,
      }).toString();

      const downloadUrl = `${API_URL}/transactions/export/csv?${queryParams}`;

      if (Platform.OS === "web") {
        window.open(downloadUrl, "_blank");
        return;
      }

      const fileUri = `${FileSystem.documentDirectory}transactions_${Date.now()}.csv`;
      const downloadResult = await FileSystem.downloadAsync(downloadUrl, fileUri);

      if (downloadResult.status === 200) {
        await Sharing.shareAsync(downloadResult.uri, {
          mimeType: "text/csv",
          dialogTitle: "Transactions Export",
          UTI: "public.comma-separated-values-text",
        });
      } else {
        Alert.alert("Error", "Failed to download CSV export.");
      }
    } catch (error) {
      console.error("CSV export error:", error);
      Alert.alert("Error", "Could not export CSV file.");
    } finally {
      setExporting(false);
    }
  };

  // Render Status Badge
  const renderStatusBadge = (status: string) => {
    let bgColor = "#E6F4EA";
    let textColor = "#137333";
    let Icon = CheckCircle2;

    if (status === "failed") {
      bgColor = "#FCE8E6";
      textColor = "#C5221F";
      Icon = XCircle;
    } else if (status === "refunded") {
      bgColor = "#E8F0FE";
      textColor = "#1A73E8";
      Icon = AlertCircle;
    } else if (status === "pending") {
      bgColor = "#FEF7E0";
      textColor = "#B06000";
      Icon = AlertCircle;
    }

    return (
      <View style={[styles.badge, { backgroundColor: bgColor }]}>
        <Icon size={12} color={textColor} style={styles.badgeIcon} />
        <Text style={[styles.badgeText, { color: textColor }]}>
          {status.toUpperCase()}
        </Text>
      </View>
    );
  };

  // Render Transaction Card Item
  const renderItem = ({ item }: { item: Transaction }) => {
    return (
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={[styles.invoiceId, { color: theme.text }]}>{item.invoiceId}</Text>
            <Text style={[styles.dateText, { color: theme.secondaryText }]}>
              {new Date(item.createdAt).toLocaleString()}
            </Text>
          </View>
          <Text style={[styles.amountText, { color: theme.text }]}>
            ₹{item.amount.toFixed(2)}
          </Text>
        </View>

        <View style={[styles.cardDivider, { backgroundColor: theme.border }]} />

        <View style={styles.cardDetails}>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>Txn ID:</Text>
            <Text style={[styles.detailValue, { color: theme.text }]}>{item.transactionId}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>Payment:</Text>
            <Text style={[styles.detailValue, { color: theme.text }]}>
              {item.paymentMethod.toUpperCase()}
            </Text>
          </View>
          {item.description ? (
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>Details:</Text>
              <Text style={[styles.detailValue, { color: theme.text }]} numberOfLines={1}>
                {item.description}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.cardFooter}>
          {renderStatusBadge(item.status)}
          <TouchableOpacity
            style={[styles.downloadBtn, { borderColor: theme.primary }]}
            onPress={() => handleDownloadReceipt(item)}
            disabled={downloadingId !== null}
          >
            {downloadingId === item._id ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <>
                <Download size={14} color={theme.primary} />
                <Text style={[styles.downloadBtnText, { color: theme.primary }]}>Receipt</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Transactions</Text>
        <TouchableOpacity
          style={styles.exportButton}
          onPress={handleExportCSV}
          disabled={exporting || transactions.length === 0}
        >
          {exporting ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <FileSpreadsheet size={22} color={transactions.length > 0 ? theme.primary : theme.secondaryText} />
          )}
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <View style={[styles.searchBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Search size={18} color={theme.secondaryText} style={styles.searchIcon} />
          <TextInput
            placeholder="Search Invoice or Txn ID..."
            placeholderTextColor={theme.secondaryText}
            style={[styles.searchInput, { color: theme.text }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearchSubmit}
            returnKeyType="search"
          />
        </View>
        <TouchableOpacity
          style={[styles.filterToggle, { backgroundColor: showFilters ? theme.surface : "transparent" }]}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Filter size={20} color={showFilters ? theme.primary : theme.text} />
        </TouchableOpacity>
      </View>

      {/* Expanded Filters Drawer */}
      {showFilters && (
        <View style={[styles.filtersDrawer, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          {/* Status Filter */}
          <Text style={[styles.filterTitle, { color: theme.secondaryText }]}>STATUS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
            {["all", "success", "failed", "refunded"].map((s) => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.chip,
                  { backgroundColor: statusFilter === s ? theme.primary : theme.surface },
                ]}
                onPress={() => setStatusFilter(s)}
              >
                <Text style={[styles.chipText, { color: statusFilter === s ? "#fff" : theme.text }]}>
                  {s.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Payment Method Filter */}
          <Text style={[styles.filterTitle, { color: theme.secondaryText, marginTop: 15 }]}>
            PAYMENT METHOD
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
            {["all", "card", "upi", "netbanking", "wallet"].map((m) => (
              <TouchableOpacity
                key={m}
                style={[
                  styles.chip,
                  { backgroundColor: methodFilter === m ? theme.primary : theme.surface },
                ]}
                onPress={() => setMethodFilter(m)}
              >
                <Text style={[styles.chipText, { color: methodFilter === m ? "#fff" : theme.text }]}>
                  {m.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Date Range Filter */}
          <Text style={[styles.filterTitle, { color: theme.secondaryText, marginTop: 15 }]}>
            DATE RANGE (YYYY-MM-DD)
          </Text>
          <View style={styles.dateRangeRow}>
            <TextInput
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.secondaryText}
              style={[
                styles.dateInput,
                { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border },
              ]}
              value={startDate}
              onChangeText={setStartDate}
              maxLength={10}
            />
            <Text style={[styles.dateRangeToText, { color: theme.text }]}>to</Text>
            <TextInput
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.secondaryText}
              style={[
                styles.dateInput,
                { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border },
              ]}
              value={endDate}
              onChangeText={setEndDate}
              maxLength={10}
            />
            {(startDate !== "" || endDate !== "") && (
              <TouchableOpacity
                style={[styles.resetDateBtn, { backgroundColor: theme.primary }]}
                onPress={() => {
                  setStartDate("");
                  setEndDate("");
                }}
              >
                <Text style={styles.resetDateText}>Reset</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Main List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={transactions}
          renderItem={renderItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <CreditCard size={48} color={theme.secondaryText} style={styles.emptyIcon} />
              <Text style={[styles.emptyText, { color: theme.secondaryText }]}>
                No transactions found
              </Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator size="small" color={theme.primary} style={styles.footerLoader} />
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 15,
    paddingTop: 50,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  exportButton: {
    padding: 5,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderBottomWidth: 1,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  filterToggle: {
    padding: 10,
    marginLeft: 8,
    borderRadius: 8,
  },
  filtersDrawer: {
    padding: 15,
    borderBottomWidth: 1,
  },
  filterTitle: {
    fontSize: 11,
    fontWeight: "bold",
    letterSpacing: 1,
    marginBottom: 8,
  },
  chipsScroll: {
    flexDirection: "row",
    marginBottom: 5,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  chipText: {
    fontSize: 11,
    fontWeight: "600",
  },
  listContent: {
    padding: 15,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 15,
    marginBottom: 15,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  invoiceId: {
    fontSize: 15,
    fontWeight: "700",
  },
  dateText: {
    fontSize: 11,
    marginTop: 2,
  },
  amountText: {
    fontSize: 16,
    fontWeight: "800",
  },
  cardDivider: {
    height: 1,
    marginVertical: 12,
  },
  cardDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: 12,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: "500",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeIcon: {
    marginRight: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  downloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  downloadBtnText: {
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 6,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyIcon: {
    marginBottom: 15,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: "500",
  },
  footerLoader: {
    marginVertical: 15,
  },
  dateRangeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
  },
  dateInput: {
    flex: 1,
    height: 36,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 10,
    fontSize: 12,
    textAlign: "center",
  },
  dateRangeToText: {
    marginHorizontal: 8,
    fontSize: 12,
    fontWeight: "600",
  },
  resetDateBtn: {
    marginLeft: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  resetDateText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "bold",
  },
});
