
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Minus, Plus, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import Header from '@/components/Header';
import CartIcon from '@/components/CartIcon';
import { ProductOption } from '@/types/product';
import { useCart } from '@/contexts/CartContext';
import { useStore } from '@/contexts/StoreContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const ProductDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { storeInfo } = useStore();
  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({});
  const [product, setProduct] = useState<any>(null);
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setIsLoading(true);
        
        if (!id) return;
        
        // Buscar produto
        const { data: productData, error: productError } = await supabase
          .from('products')
          .select(`
            *,
            categories (name)
          `)
          .eq('id', id)
          .single();
        
        if (productError) {
          console.error("Error fetching product:", productError);
          toast.error("Erro ao carregar o produto");
          return;
        }
        
        // Buscar opções do produto
        const { data: optionsData, error: optionsError } = await supabase
          .from('product_options')
          .select(`
            *,
            option_variations (*)
          `)
          .eq('product_id', id);
        
        if (optionsError) {
          console.error("Error fetching product options:", optionsError);
        }
        
        if (productData) {
          setProduct({
            id: productData.id,
            name: productData.name,
            description: productData.description || '',
            price: Number(productData.price),
            image: productData.image_url || "https://source.unsplash.com/featured/?food",
            category: productData.categories?.name || "Sem categoria"
          });
          
          // Converter opções para o formato esperado
          const formattedOptions: ProductOption[] = (optionsData || []).map(option => ({
            id: option.id,
            title: option.title,
            required: option.required || false,
            maxOptions: option.required ? 1 : undefined,
            variations: (option.option_variations || []).map(variation => ({
              id: variation.id,
              name: variation.name,
              price: Number(variation.price) || 0
            }))
          }));
          
          setProductOptions(formattedOptions);
        }
      } catch (error) {
        console.error("Error:", error);
        toast.error("Erro ao carregar o produto");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchProduct();
  }, [id]);
  
  const handleBack = () => {
    navigate(-1);
  };
  
  const handleIncreaseQuantity = () => {
    setQuantity(prevQuantity => prevQuantity + 1);
  };
  
  const handleDecreaseQuantity = () => {
    if (quantity > 1) {
      setQuantity(prevQuantity => prevQuantity - 1);
    }
  };
  
  const handleRadioChange = (optionId: string, variationId: string) => {
    setSelectedOptions(prev => ({
      ...prev,
      [optionId]: [variationId]
    }));
  };
  
  const handleCheckboxChange = (optionId: string, variationId: string, checked: boolean) => {
    setSelectedOptions(prev => {
      const currentSelections = prev[optionId] || [];
      
      if (checked) {
        return {
          ...prev,
          [optionId]: [...currentSelections, variationId]
        };
      } else {
        return {
          ...prev,
          [optionId]: currentSelections.filter(id => id !== variationId)
        };
      }
    });
  };
  
  const calculateTotalPrice = () => {
    if (!product) return 0;
    
    let total = product.price;
    
    Object.entries(selectedOptions).forEach(([optionId, variationIds]) => {
      const option = productOptions.find(opt => opt.id === optionId);
      if (!option) return;
      
      variationIds.forEach(varId => {
        const variation = option.variations.find(v => v.id === varId);
        if (variation) {
          total += variation.price;
        }
      });
    });
    
    return total * quantity;
  };

  const handleAddToCart = () => {
    if (!product) return;
    
    // Criar objeto com nomes das opções selecionadas para melhor exibição
    const selectedOptionsWithNames: Record<string, string[]> = {};
    Object.entries(selectedOptions).forEach(([optionId, variationIds]) => {
      const option = productOptions.find(opt => opt.id === optionId);
      if (option) {
        selectedOptionsWithNames[option.title] = variationIds.map(varId => {
          const variation = option.variations.find(v => v.id === varId);
          return variation ? variation.name : '';
        }).filter(name => name !== '');
      }
    });
    
    addToCart({
      id: `${product.id}-${Date.now()}`,
      productId: product.id,
      name: product.name,
      price: calculateTotalPrice() / quantity,
      quantity: quantity,
      image: product.image,
      selectedOptions: selectedOptionsWithNames,
      totalPrice: calculateTotalPrice(),
    });
    
    navigate('/cart');
  };
  
  const isButtonDisabled = !product || productOptions.some(option => {
    return option.required && (!selectedOptions[option.id] || selectedOptions[option.id].length === 0);
  });
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <Header restaurantName={storeInfo.name} showSearch={false} />
        <div className="p-4 text-center">
          <p>Carregando produto...</p>
        </div>
      </div>
    );
  }
  
  if (!product) {
    return (
      <div className="min-h-screen bg-white">
        <Header restaurantName={storeInfo.name} showSearch={false} />
        <div className="p-4 text-center">
          <p>Produto não encontrado</p>
          <Button onClick={() => navigate('/')} className="mt-4">
            Voltar para a página inicial
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header 
        restaurantName={storeInfo.name}
        showSearch={false}
        rightContent={<CartIcon />}
      />
      
      <div className="relative">
        <button 
          className="absolute top-4 left-4 z-10 bg-white rounded-full p-2 shadow-md"
          onClick={handleBack}
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        
        <div className="h-64 bg-gray-300 relative">
          <img 
            src={product.image} 
            alt={product.name} 
            className="w-full h-full object-cover"
          />
        </div>
      </div>
      
      <div className="bg-white p-4">
        <h1 className="text-2xl font-bold">{product.name}</h1>
        
        {product.description && (
          <p className="text-gray-700 mt-2 text-sm">
            {product.description}
          </p>
        )}
        
        <p className="mt-2 font-medium text-lg">
          A partir de R$ {product.price.toFixed(2)}
        </p>
      </div>
      
      {productOptions.length > 0 && (
        <>
          <div className="h-2 bg-gray-50"></div>
          
          <div className="bg-white">
            {productOptions.map(option => (
              <Card key={option.id} className="mb-4 border-0 shadow-none">
                <div className="p-4">
                  <div className="flex justify-between items-center mb-2">
                    <h2 className="font-semibold">{option.title}</h2>
                    {option.required && (
                      <span className="bg-gray-900 text-white text-xs font-medium px-2 py-1 rounded">
                        OBRIGATÓRIO
                      </span>
                    )}
                  </div>
                  
                  <p className="text-sm text-gray-500 mb-4">
                    Escolha {option.maxOptions ? `até ${option.maxOptions}` : '1'} opção
                  </p>
                  
                  {option.maxOptions && option.maxOptions > 1 ? (
                    <div className="space-y-3">
                      {option.variations.map(variation => (
                        <div key={variation.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Checkbox 
                              id={variation.id} 
                              checked={selectedOptions[option.id]?.includes(variation.id) || false}
                              onCheckedChange={(checked) => 
                                handleCheckboxChange(option.id, variation.id, checked === true)
                              }
                            />
                            <label htmlFor={variation.id} className="text-sm font-medium">
                              {variation.name}
                            </label>
                          </div>
                          <span className="text-sm">
                            {variation.price > 0 ? `+ R$ ${variation.price.toFixed(2)}` : 'Grátis'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <RadioGroup 
                      value={selectedOptions[option.id]?.[0] || ""}
                      onValueChange={(value: string) => handleRadioChange(option.id, value)}
                      className="space-y-3"
                    >
                      {option.variations.map(variation => (
                        <div key={variation.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value={variation.id} id={variation.id} />
                            <label htmlFor={variation.id} className="text-sm font-medium">
                              {variation.name}
                            </label>
                          </div>
                          <span className="text-sm">
                            {variation.price > 0 ? `+ R$ ${variation.price.toFixed(2)}` : 'Grátis'}
                          </span>
                        </div>
                      ))}
                    </RadioGroup>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
      
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 flex items-center gap-4">
        <div className="flex items-center border rounded-md">
          <button 
            onClick={handleDecreaseQuantity} 
            className="px-4 py-2 text-gray-500"
            disabled={quantity <= 1}
          >
            <Minus className="h-5 w-5" />
          </button>
          
          <div className="px-4 py-2 border-x">
            {quantity}
          </div>
          
          <button 
            onClick={handleIncreaseQuantity} 
            className="px-4 py-2 text-gray-500"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
        
        <Button 
          className="flex-1 text-base py-6 gap-2" 
          disabled={isButtonDisabled}
          onClick={handleAddToCart}
        >
          <ShoppingCart className="h-5 w-5" />
          Adicionar
          <span className="ml-1">
            R$ {calculateTotalPrice().toFixed(2)}
          </span>
        </Button>
      </div>
    </div>
  );
};

export default ProductDetail;
