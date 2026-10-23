import { useEffect, useState } from 'react'
import { Plus, Wand2, Image as ImageIcon } from 'lucide-react'
import { Button, Field, Input, Modal, Select, Textarea } from '../../components/ui'
import { ImageUpload } from '../../components/ImageUpload'
import { BarcodeImageUpload } from '../../components/BarcodeImageUpload'
import { toast } from '../../stores/toasts'
import { useSettings } from '../../stores/settings'
import { useMoney } from '../../hooks/useMoney'
import { errMessage } from '../../lib/errors'
import { amountToCents } from '../../../../shared/util'
import type { Category, Product } from '../../../../shared/types'

interface Props {
  open: boolean
  onClose: () => void
  product: Product | null
  categories: Category[]
  onSaved: () => void
  onCategoryCreated: () => void
}

export function ProductModal({
  open,
  onClose,
  product,
  categories,
  onSaved,
  onCategoryCreated
}: Props) {
  const fmt = useMoney()
  const settings = useSettings((s) => s.settings)

  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [price, setPrice] = useState('')
  const [cost, setCost] = useState('')
  const [stock, setStock] = useState('0')
  const [threshold, setThreshold] = useState('5')
  const [categoryId, setCategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [image, setImage] = useState<string | null>(null)
  const [newCategory, setNewCategory] = useState('')
  const [addingCategory, setAddingCategory] = useState(false)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setName(product?.name ?? '')
    setSku(product?.sku ?? '')
    setPrice(product ? (product.price_cents / 100).toFixed(2) : '')
    setCost(product ? (product.cost_cents / 100).toFixed(2) : '')
    setStock(String(product?.stock ?? 0))
    setThreshold(String(product?.low_stock_threshold ?? settings?.low_stock_default ?? 5))
    setCategoryId(product?.category_id != null ? String(product.category_id) : '')
    setDescription(product?.description ?? '')
    setImage(product?.image ?? null)
    setErrors({})
    setNewCategory('')
  }, [open, product, settings])

  async function generateSku() {
    const s = await window.api.products.generateSku()
    setSku(s)
  }

  async function addCategory() {
    const name = newCategory.trim()
    if (!name) return
    setAddingCategory(true)
    try {
      const cat = await window.api.categories.create(name)
      setCategoryId(String(cat.id))
      setNewCategory('')
      onCategoryCreated()
      toast.success('Category added', cat.name)
    } catch (e) {
      toast.error('Could not add category', errMessage(e))
    } finally {
      setAddingCategory(false)
    }
  }

  function validate(): boolean {
    const next: Record<string, string> = {}
    if (!name.trim()) next.name = 'Name is required'
    if (!sku.trim()) next.sku = 'SKU / barcode is required'
    const priceVal = Number(price)
    if (price === '' || Number.isNaN(priceVal) || priceVal < 0) next.price = 'Enter a valid price'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function save() {
    if (!validate()) return
    setBusy(true)
    try {
      const input = {
        name: name.trim(),
        sku: sku.trim(),
        price_cents: amountToCents(Number(price)),
        cost_cents: cost === '' ? 0 : amountToCents(Number(cost) || 0),
        stock: parseInt(stock, 10) || 0,
        low_stock_threshold: parseInt(threshold, 10) || 5,
        category_id: categoryId ? Number(categoryId) : null,
        description: description.trim() || null,
        image
      }
      if (product) {
        await window.api.products.update(product.id, input)
        toast.success('Product updated', input.name)
      } else {
        await window.api.products.create(input)
        toast.success('Product added', input.name)
      }
      onSaved()
      onClose()
    } catch (e) {
      toast.error('Could not save product', errMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={product ? 'Edit product' : 'Add product'}
      description={product ? `Editing "${product.name}"` : 'Create a new product in your catalog'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            {product ? 'Save changes' : 'Add product'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Product name" error={errors.name} className="sm:col-span-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Basmati Rice 5kg"
            invalid={!!errors.name}
            autoFocus
          />
        </Field>

        <Field label="SKU / Barcode" error={errors.sku}>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="Scan or enter barcode"
                invalid={!!errors.sku}
              />
              <Button type="button" variant="secondary" size="icon" onClick={generateSku} title="Generate barcode">
                <Wand2 style={{ width: 16, height: 16 }} />
              </Button>
            </div>
            <BarcodeImageUpload
              onBarcodeDetected={(code) => {
                setSku(code)
                toast.success('Barcode detected', code)
              }}
            />
            <p className="text-xs text-app-faint">
              Upload a barcode image to auto-fill the code
            </p>
          </div>
        </Field>

        <Field label="Price" error={errors.price}>
          <Input
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="0.00"
            inputMode="decimal"
            invalid={!!errors.price}
          />
        </Field>

        <Field label="Cost (optional)">
          <Input
            value={cost}
            onChange={(e) => setCost(e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="0.00"
            inputMode="decimal"
          />
        </Field>

        <Field label="Stock quantity">
          <Input
            value={stock}
            onChange={(e) => setStock(e.target.value.replace(/[^0-9-]/g, ''))}
            inputMode="numeric"
          />
        </Field>

        <Field label="Low stock threshold">
          <Input
            value={threshold}
            onChange={(e) => setThreshold(e.target.value.replace(/[^0-9]/g, ''))}
            inputMode="numeric"
          />
        </Field>

        <Field label="Category">
          <div className="flex gap-2">
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Uncategorized</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setAddingCategory((v) => !v)}
              title="Add category"
            >
              <Plus style={{ width: 16, height: 16 }} />
            </Button>
          </div>
        </Field>

        {addingCategory && (
          <div className="flex items-center gap-2">
            <Input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="New category name"
            />
            <Button variant="secondary" onClick={addCategory} disabled={!newCategory.trim()}>
              Add
            </Button>
          </div>
        )}

        <Field label="Description" className="sm:col-span-2">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
            rows={2}
          />
        </Field>

        <div className="sm:col-span-2">
          <p className="mb-1.5 text-[13px] font-medium text-app-muted">Product image</p>
          <ImageUpload value={image} onChange={setImage} />
        </div>
      </div>
      <p className="mt-4 text-xs text-app-faint">
        Price preview: <span className="font-medium text-app-muted">{fmt(Number(price) ? amountToCents(Number(price)) : 0)}</span>
      </p>
    </Modal>
  )
}
