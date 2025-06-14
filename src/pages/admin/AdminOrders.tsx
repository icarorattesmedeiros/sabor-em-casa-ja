import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Eye, PackageOpen } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { OrderDB, OrderStatus, OrderItem } from '@/types/product';
import { format, parseISO } from 'date-fns';
import OrderDetailsDialog from '@/components/admin/OrderDetailsDialog';

const OrderStatusMap = {
  'pending': { label: 'Pendente', color: 'bg-yellow-500' },
  'processing': { label: 'Em preparação', color: 'bg-amber-500' },
  'delivering': { label: 'Em entrega', color: 'bg-blue-500' },
  'delivered': { label: 'Entregue', color: 'bg-green-500' },
  'cancelled': { label: 'Cancelado', color: 'bg-red-500' },
  'awaiting_payment': { label: 'Aguardando pagamento', color: 'bg-orange-500' }
};

const AdminOrders = () => {
  const [orders, setOrders] = useState<OrderDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<OrderDB | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  
  useEffect(() => {
    fetchOrders();
  }, [statusFilter, searchTerm]);
  
  const fetchOrders = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      
      if (searchTerm) {
        query = query.or(`id.ilike.%${searchTerm}%`);
      }
      
      const { data: ordersData, error } = await query;
      
      if (error) {
        throw error;
      }

      // Ajuste: itens pode ser string (json) ou array (jsonb)
      const ordersWithProfiles = await Promise.all(
        (ordersData || []).map(async (order) => {
          let profileData = null;
          
          // Fetch profile data separademente
          const { data: profile } = await supabase
            .from('profiles')
            .select('name, phone, email')
            .eq('id', order.user_id)
            .maybeSingle();
            
          if (profile) {
            profileData = profile;
          }

          let parsedItems = [];
          try {
            parsedItems = typeof order.items === 'string'
              ? JSON.parse(order.items)
              : Array.isArray(order.items) ? order.items : [];
          } catch {
            parsedItems = [];
          }

          // Corrigir o address para nunca ser {}
          let parsedAddress: any = null;
          try {
            if (!order.address) {
              parsedAddress = {
                street: "",
                number: "",
                neighborhood: "",
                city: "",
                state: "",
                zipCode: ""
              };
            } else if (typeof order.address === "string") {
              const addr = JSON.parse(order.address);
              parsedAddress = addr && typeof addr === "object"
                ? {
                    street: addr.street || "",
                    number: addr.number || "",
                    neighborhood: addr.neighborhood || "",
                    city: addr.city || "",
                    state: addr.state || "",
                    zipCode: addr.zipCode || ""
                  }
                : {
                    street: "",
                    number: "",
                    neighborhood: "",
                    city: "",
                    state: "",
                    zipCode: ""
                  };
            } else if (typeof order.address === "object") {
              parsedAddress = {
                street: order.address.street || "",
                number: order.address.number || "",
                neighborhood: order.address.neighborhood || "",
                city: order.address.city || "",
                state: order.address.state || "",
                zipCode: order.address.zipCode || "",
              };
            } else {
              parsedAddress = {
                street: "",
                number: "",
                neighborhood: "",
                city: "",
                state: "",
                zipCode: ""
              };
            }
          } catch {
            parsedAddress = {
              street: "",
              number: "",
              neighborhood: "",
              city: "",
              state: "",
              zipCode: ""
            };
          }

          return {
            ...order,
            items: parsedItems,
            address: parsedAddress,
            profiles: profileData,
          };
        })
      );
      
      setOrders(ordersWithProfiles as OrderDB[]);
    } catch (error: any) {
      toast.error(`Erro ao buscar pedidos: ${error.message}`);
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', orderId);
      
      if (error) throw error;
      
      setOrders(prev => prev.map(order => 
        order.id === orderId 
          ? { ...order, status: newStatus, updated_at: new Date().toISOString() } 
          : order
      ));
      
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({
          ...selectedOrder,
          status: newStatus,
          updated_at: new Date().toISOString()
        });
      }
      
      toast.success('Status do pedido atualizado com sucesso');
    } catch (error: any) {
      toast.error(`Erro ao atualizar status: ${error.message}`);
    }
  };
  
  const viewOrderDetails = (order: OrderDB) => {
    console.log('Viewing order details:', order);
    setSelectedOrder(order);
    setIsDetailsOpen(true);
  };
  
  const formatDate = (dateString: string) => {
    try {
      const date = parseISO(dateString);
      return format(date, 'dd/MM/yyyy HH:mm');
    } catch (error) {
      console.error('Error parsing date:', error);
      return dateString;
    }
  };
  
  const filteredOrders = orders;
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Pedidos</h1>
        <p className="text-gray-500">Gerencie os pedidos da sua loja</p>
      </div>
      
      <Card className="p-6">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
            <Input 
              placeholder="Buscar por ID do pedido..." 
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="w-full md:w-[200px]">
            <Select 
              value={statusFilter}
              onValueChange={setStatusFilter}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="awaiting_payment">Aguardando pagamento</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="processing">Em preparação</SelectItem>
                <SelectItem value="delivering">Em entrega</SelectItem>
                <SelectItem value="delivered">Entregue</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-8 text-center">Carregando pedidos...</div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-10">
              <PackageOpen className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-4 text-lg font-medium text-gray-600">Nenhum pedido encontrado.</p>
              <p className="text-sm text-gray-500">
                {searchTerm || statusFilter !== 'all' ? 'Tente outros filtros.' : 'Não existem pedidos registrados.'}
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left pb-3 font-medium text-gray-500">Pedido</th>
                  <th className="text-left pb-3 font-medium text-gray-500">Cliente</th>
                  <th className="text-left pb-3 font-medium text-gray-500">Status</th>
                  <th className="text-left pb-3 font-medium text-gray-500 hidden md:table-cell">Data</th>
                  <th className="text-left pb-3 font-medium text-gray-500">Total</th>
                  <th className="text-right pb-3 font-medium text-gray-500">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => {
                  const itemsArray = Array.isArray(order.items) ? order.items : [];
                  const customerName = order.profiles?.name || 
                    (order.address && typeof order.address === 'object' && 'customer_name' in order.address 
                      ? order.address.customer_name 
                      : 'Cliente não encontrado');
                  
                  return (
                    <tr key={order.id} className="border-b last:border-0">
                      <td className="py-4">
                        <div>
                          <p className="font-medium">#{order.id.slice(0, 8)}</p>
                          <p className="text-xs text-gray-500">{itemsArray.length} itens</p>
                        </div>
                      </td>
                      <td className="py-4">
                        {customerName}
                      </td>
                      <td className="py-4">
                        <Badge 
                          variant="default" 
                          className={`${OrderStatusMap[order.status as OrderStatus]?.color || 'bg-gray-500'} hover:${OrderStatusMap[order.status as OrderStatus]?.color || 'bg-gray-500'}`}
                        >
                          {OrderStatusMap[order.status as OrderStatus]?.label || 'Desconhecido'}
                        </Badge>
                      </td>
                      <td className="py-4 text-gray-600 hidden md:table-cell">
                        {order.created_at ? format(parseISO(order.created_at), 'dd/MM/yyyy HH:mm') : 'Data inválida'}
                      </td>
                      <td className="py-4 font-medium">
                        R$ {order.total.toFixed(2)}
                      </td>
                      <td className="py-4 text-right">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="gap-2"
                          onClick={() => viewOrderDetails(order)}
                        >
                          <Eye className="h-4 w-4" />
                          <span className="hidden md:inline">Ver detalhes</span>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>
      
      <OrderDetailsDialog 
        order={selectedOrder}
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        onUpdateStatus={updateOrderStatus}
      />
    </div>
  );
};

export default AdminOrders;
