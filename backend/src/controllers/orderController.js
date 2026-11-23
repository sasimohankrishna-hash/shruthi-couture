const { ApiError } = require("../middleware/errorHandler");

function createOrderController(
  supabase,
  createAuthenticatedSupabaseClient,
) {
  async function create(req, res, next) {
    try {
      const variantIds = [...new Set(req.body.items.map((item) => item.variantId))];
      const { data: variants, error: variantsError } = await supabase
        .from("product_variants")
        .select("id,size,color")
        .in("id", variantIds)
        .eq("is_active", true);

      if (variantsError) {
        throw new ApiError(502, "Could not verify requested variants");
      }

      if ((variants || []).length !== variantIds.length) {
        throw new ApiError(409, "A requested variant is unavailable");
      }

      const items = req.body.items.map((item) => ({
        variant_id: item.variantId,
        quantity: item.quantity,
      }));

      const { data: orderId, error: createError } = await supabase.rpc(
        "create_order",
        {
          p_customer_name: req.body.customerName.trim(),
          p_customer_phone: req.body.customerPhone.trim(),
          p_items: items,
        },
      );

      if (createError) {
        const message = createError.message || "";
        if (/unavailable|stock|price|quantity|customer|items|variant/i.test(message)) {
          throw new ApiError(409, "A requested item is unavailable");
        }
        throw new ApiError(502, "Could not create order");
      }

      if (typeof orderId !== "string" || !orderId) {
        throw new ApiError(502, "Order creation returned an invalid reference");
      }

      const [{ data: order, error: orderError }, { data: orderItems, error: itemsError }] =
        await Promise.all([
          supabase
            .from("orders")
            .select("id,customer_name,customer_phone,total_amount")
            .eq("id", orderId)
            .maybeSingle(),
          supabase
            .from("order_items")
            .select(
              "id,product_id,variant_id,product_name,selected_size,selected_color,quantity,product_price,line_total",
            )
            .eq("order_id", orderId),
        ]);

      if (orderError || itemsError || !order) {
        throw new ApiError(
          502,
          `Order ${orderId} was created, but its details could not be retrieved`,
        );
      }

      return res.status(201).json({
        success: true,
        message: "Order request created successfully",
        data: {
          ...order,
          items: orderItems || [],
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  async function confirm(req, res, next) {
    try {
      const userSupabase = createAuthenticatedSupabaseClient(
        req.auth.accessToken,
      );
      const { error } = await userSupabase.rpc("confirm_order", {
        p_order_id: req.params.orderId,
      });

      if (error) {
        const message = error.message || "";
        if (/administrator access required|not authorized|permission denied/i.test(message)) {
          throw new ApiError(403, "Administrator access required");
        }
        if (/order not found/i.test(message)) {
          throw new ApiError(404, "Order not found");
        }
        if (/insufficient stock|stock/i.test(message)) {
          throw new ApiError(409, "Order cannot be confirmed with current stock");
        }
        throw new ApiError(502, "Could not confirm order");
      }

      return res.json({
        success: true,
        message: "Order confirmed successfully",
        data: null,
      });
    } catch (error) {
      return next(error);
    }
  }

  return { create, confirm };
}

module.exports = { createOrderController };
