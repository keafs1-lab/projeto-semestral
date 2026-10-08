export type Permission = 'USER_MANAGE'|'PRODUCT_CREATE'|'PRODUCT_UPDATE'|'PRODUCT_DELETE'|'SALE_CREATE'|'RETURN_CREATE'|'LOAD_CREATE'|'REVENUE_VIEW';
export type PaymentMethod = 'DINHEIRO'|'PIX'|'CARTAO_CREDITO'|'CARTAO_DEBITO'|'OUTRO';
export type ReturnReason = 'DEFEITO'|'ARREPENDIMENTO'|'TROCA'|'OUTRO'|'NAO_ESPECIFICADO';
export interface SessionUser { id:number; username:string; permissions:Permission[]; }
export interface Product { id:number; name:string; code:string; price:number; costPrice:number|null; stock:number; }
export interface SaleItemInput { productId:number; quantity:number; }
export interface SaleInput { items:SaleItemInput[]; paymentMethod:PaymentMethod; }
export interface ReturnItemInput { saleItemId:number; quantity:number; }
export interface ReturnInput { saleId:number; items:ReturnItemInput[]; reason:ReturnReason; reasonOther?:string; }
export interface LoadItemInput { productId:number; quantity:number; source:string; unitCost?:number; }
export interface LoadInput { items:LoadItemInput[]; }
