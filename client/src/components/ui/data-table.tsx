import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Search, X, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickFilter {
  id: string;
  label: string;
  value: string;
  count?: number;
}

interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T, index: number) => React.ReactNode;
  sortable?: boolean;
  width?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  searchable?: boolean;
  searchPlaceholder?: string;
  searchKeys?: (keyof T)[];
  quickFilters?: QuickFilter[];
  activeFilter?: string;
  onFilterChange?: (filterId: string | null) => void;
  stickyHeader?: boolean;
  maxHeight?: string;
  emptyMessage?: string;
  loading?: boolean;
  onRowClick?: (item: T, index: number) => void;
  rowClassName?: (item: T, index: number) => string;
  testIdPrefix?: string;
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  searchable = false,
  searchPlaceholder = "Buscar...",
  searchKeys = [],
  quickFilters = [],
  activeFilter,
  onFilterChange,
  stickyHeader = true,
  maxHeight = "500px",
  emptyMessage = "Nenhum registro encontrado",
  loading = false,
  onRowClick,
  rowClassName,
  testIdPrefix = "table",
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = React.useState("");

  const filteredData = React.useMemo(() => {
    if (!searchQuery || searchKeys.length === 0) return data;
    
    const query = searchQuery.toLowerCase();
    return data.filter((item) =>
      searchKeys.some((key) => {
        const value = item[key];
        if (value == null) return false;
        return String(value).toLowerCase().includes(query);
      })
    );
  }, [data, searchQuery, searchKeys]);

  const getCellValue = (item: T, column: Column<T>, index: number): React.ReactNode => {
    if (column.render) {
      return column.render(item, index);
    }
    const value = item[column.key as keyof T];
    if (value == null) return "-";
    return String(value);
  };

  return (
    <div className="space-y-4">
      {(searchable || quickFilters.length > 0) && (
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          {searchable && (
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10"
                data-testid={`${testIdPrefix}-search`}
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
          
          {quickFilters.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Button
                variant={!activeFilter ? "secondary" : "ghost"}
                size="sm"
                onClick={() => onFilterChange?.(null)}
                data-testid={`${testIdPrefix}-filter-all`}
              >
                Todos
              </Button>
              {quickFilters.map((filter) => (
                <Button
                  key={filter.id}
                  variant={activeFilter === filter.id ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => onFilterChange?.(filter.id)}
                  data-testid={`${testIdPrefix}-filter-${filter.id}`}
                >
                  {filter.label}
                  {filter.count !== undefined && (
                    <Badge variant="outline" className="ml-2 text-xs">
                      {filter.count}
                    </Badge>
                  )}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      <Table stickyHeader={stickyHeader} maxHeight={maxHeight}>
        <TableHeader sticky={stickyHeader}>
          <TableRow>
            {columns.map((column) => (
              <TableHead
                key={String(column.key)}
                style={column.width ? { width: column.width } : undefined}
              >
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {columns.map((column) => (
                  <TableCell key={String(column.key)}>
                    <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : filteredData.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-24 text-center text-muted-foreground"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            filteredData.map((item, index) => (
              <TableRow
                key={index}
                className={cn(
                  onRowClick && "cursor-pointer",
                  rowClassName?.(item, index)
                )}
                onClick={() => onRowClick?.(item, index)}
                data-testid={`${testIdPrefix}-row-${index}`}
              >
                {columns.map((column) => (
                  <TableCell key={String(column.key)}>
                    {getCellValue(item, column, index)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {filteredData.length > 0 && (
        <div className="text-sm text-muted-foreground text-right">
          {filteredData.length === data.length
            ? `${data.length} registros`
            : `${filteredData.length} de ${data.length} registros`}
        </div>
      )}
    </div>
  );
}
