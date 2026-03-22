/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import logo from './assets/icon.png';
// Placeholder for G_Pay.png since it's missing. User should replace this with the actual image.
const gpayLogo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

import { 
  QrCode, 
  Plus, 
  Minus, 
  Trash2, 
  Download, 
  Share2, 
  MessageSquare, 
  ShoppingCart, 
  User,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  Camera,
  ChevronDown,
  Trash,
  Phone,
  Hash,
  CreditCard
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Product, BillSummary } from './types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [invoiceNo, setInvoiceNo] = useState(() => `INV-${Math.floor(1000 + Math.random() * 9000)}`);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [toast, setToast] = useState<{ title: string; message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [manualEntry, setManualEntry] = useState({ name: '', qty: '1', price: '', amount: '' });
  const [quickPaste, setQuickPaste] = useState('');
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [scannerError, setScannerError] = useState<string | null>(null);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const showToast = (title: string, message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ title, message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const startScanner = async () => {
    setIsScannerOpen(true);
    setLastScanned(null);
    setScannerError(null);
    
    // Wait for modal to open and element to be available
    setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode("qr-reader");
        scannerRef.current = scanner;
        
        const config = { 
          fps: 10, 
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        };
        
        await scanner.start(
          { facingMode: "environment" }, 
          config, 
          (decodedText) => {
            handleScan(decodedText);
            stopScanner();
          },
          (errorMessage) => {
            // Ignore frame errors
          }
        );
      } catch (err) {
        console.error("Scanner start error", err);
        setScannerError(err instanceof Error ? err.message : "Could not access camera");
      }
    }, 500);
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
      } catch (err) {
        console.error("Scanner stop error", err);
      }
      scannerRef.current = null;
    }
    setIsScannerOpen(false);
  };

  const handleScan = (data: string) => {
    setLastScanned(data);
    try {
      // Expected format: S No., Product Name, Quantity, Price, Discount, Amount
      // Example: 1, Regular Maggi 100g, 1, 50, 50%, 25
      const parts = data.split(',').map(p => p.trim());
      
      // Handle cases where S.No might be missing or included
      let name, quantity, price, amount;
      
      if (parts.length >= 6) {
        // Full format: S.No, Name, Qty, Price, Disc%, Amount
        name = parts[1];
        quantity = parseInt(parts[2]) || 1;
        price = parseFloat(parts[3]);
        amount = parseFloat(parts[5]);
      } else if (parts.length === 5) {
        // Format: S.No, Name, Qty, Price, Amount (No Disc%)
        name = parts[1];
        quantity = parseInt(parts[2]) || 1;
        price = parseFloat(parts[3]);
        amount = parseFloat(parts[4]);
      } else if (parts.length === 4) {
        // Format: Name, Qty, Price, Amount
        name = parts[0];
        quantity = parseInt(parts[1]) || 1;
        price = parseFloat(parts[2]);
        amount = parseFloat(parts[3]);
      } else if (parts.length === 3) {
        // Format: Name, Qty, Price
        name = parts[0];
        quantity = parseInt(parts[1]) || 1;
        price = parseFloat(parts[2]);
        amount = price * quantity;
      } else {
        showToast("Invalid Format", "Need at least: Name, Qty, Price", "error");
        return;
      }

      if (!name || isNaN(price) || isNaN(amount)) {
        showToast("Parse Error", "Check your data values", "error");
        return;
      }

      addOrUpdateProduct({ name, quantity, price, amount });
    } catch (err) {
      showToast("Parse Error", "Failed to parse QR data", "error");
    }
  };

  const handleQuickPaste = () => {
    if (!quickPaste.trim()) return;
    handleScan(quickPaste);
    setQuickPaste('');
  };

  const addOrUpdateProduct = ({ name, quantity, price, amount }: { name: string; quantity: number; price: number; amount: number }) => {
    setProducts(prev => {
      const existingIndex = prev.findIndex(p => p.name.toLowerCase() === name.toLowerCase());
      
      if (existingIndex !== -1) {
        const updated = [...prev];
        const p = updated[existingIndex];
        const newQty = p.quantity + quantity;
        const totalPrice = p.price * newQty;
        const discountPercent = p.discountPercent;
        const newAmount = totalPrice * (1 - discountPercent / 100);
        
        updated[existingIndex] = { ...p, quantity: newQty, amount: newAmount };
        showToast("Updated", `${name} quantity increased`);
        return updated;
      } else {
        const totalPrice = price * quantity;
        const discountPercent = totalPrice > 0 ? ((totalPrice - amount) / totalPrice) * 100 : 0;
        
        const newProduct: Product = {
          id: Math.random().toString(36).substr(2, 9),
          serialNumber: prev.length + 1,
          name,
          quantity,
          price,
          discountPercent: Math.round(discountPercent),
          amount
        };
        
        showToast("Added", `${name} added to cart`);
        return [...prev, newProduct];
      }
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setProducts(prev => prev.map(p => {
      if (p.id === id) {
        const newQty = Math.max(1, p.quantity + delta);
        const unitDiscountedPrice = p.price * (1 - p.discountPercent / 100);
        return { ...p, quantity: newQty, amount: unitDiscountedPrice * newQty };
      }
      return p;
    }));
  };

  const removeProduct = (id: string) => {
    setProducts(prev => {
      const filtered = prev.filter(p => p.id !== id);
      return filtered.map((p, i) => ({ ...p, serialNumber: i + 1 }));
    });
    showToast("Removed", "Item deleted", "warning");
  };

  const clearAllProducts = () => {
    if (products.length === 0) return;
    setProducts([]);
    showToast("Cleared", "All items removed", "warning");
  };

  const handleManualAdd = () => {
    const { name, qty, price, amount } = manualEntry;
    const q = parseInt(qty) || 1;
    const p = parseFloat(price) || 0;
    let a = parseFloat(amount);
    
    if (!name || p <= 0) {
      showToast("Invalid", "Enter name & price", "error");
      return;
    }
    
    if (isNaN(a) || a <= 0) a = p * q;
    
    addOrUpdateProduct({ name, quantity: q, price: p, amount: a });
    setManualEntry({ name: '', qty: '1', price: '', amount: '' });
  };

  const calculateSummary = (): BillSummary => {
    const subtotal = products.reduce((acc, p) => acc + (p.price * p.quantity), 0);
    const grandTotal = products.reduce((acc, p) => acc + p.amount, 0);
    const totalDiscount = subtotal - grandTotal;
    
    return {
      subtotal,
      totalDiscount,
      grandTotal,
      totalSavings: totalDiscount
    };
  };

  const summary = calculateSummary();

  const generatePDF = (action: 'download' | 'share') => {
    if (products.length === 0) {
      showToast("Empty", "Add products first", "error");
      return;
    }

    const doc = new jsPDF();
    const name = customerName || "Customer";
    const fileName = `${name.replace(/\s+/g, '_')}_bill.pdf`;

    // Header Styling
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, 210, 45, 'F');
    
    // Add Logo to PDF
    try {
      doc.addImage(logo, 'PNG', 10, 10, 25, 25);
    } catch (e) {
      console.error("Logo could not be added to PDF", e);
    }

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(24);
    doc.setFont(undefined, 'bold');
    doc.text("MAHSUA DIGITAL", 105, 20, { align: "center" });
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text("MP Online | Printing | Question Paper | Photo Studio | Typing", 105, 28, { align: "center" });
    doc.text("Mahsua 517 Mahsua Road Raipur Karchuliyan, Madhya Pradesh 486114", 105, 35, { align: "center" });
    
    // Customer & Invoice Details
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text("BILL TO:", 20, 55);
    doc.setFont(undefined, 'normal');
    doc.text(`Name: ${name}`, 20, 62);
    doc.text(`Contact: ${customerPhone || 'N/A'}`, 20, 67);
    
    doc.setFont(undefined, 'bold');
    doc.text("INVOICE DETAILS:", 140, 55);
    doc.setFont(undefined, 'normal');
    doc.text(`Invoice No: ${invoiceNo}`, 140, 62);
    doc.text(`Payment Mode: ${paymentMode}`, 140, 67);
    doc.text(`Date: ${currentTime.toLocaleDateString()}`, 140, 72);
    doc.text(`Time: ${currentTime.toLocaleTimeString()}`, 140, 77);

    // Table
    const tableData = products.map(p => [
      p.serialNumber,
      p.name,
      p.quantity,
      `Rs. ${p.price.toFixed(2)}`,
      `${p.discountPercent}%`,
      `Rs. ${p.amount.toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: 80,
      head: [['S.No', 'Product Name', 'Qty', 'Price', 'Disc %', 'Amount']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], halign: 'center' },
      columnStyles: {
        0: { halign: 'center' },
        2: { halign: 'center' },
        3: { halign: 'right' },
        4: { halign: 'center' },
        5: { halign: 'right' }
      },
      styles: { fontSize: 9 }
    });

    // Summary
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    
    // Add G_Pay QR Code
    try {
      doc.addImage(gpayLogo, 'PNG', 20, finalY - 5, 40, 40);
    } catch (e) {
      console.error("G_Pay QR code could not be added to PDF", e);
    }

    doc.setFontSize(10);
    doc.text(`Subtotal: Rs. ${summary.subtotal.toFixed(2)}`, 130, finalY);
    doc.setTextColor(220, 38, 38);
    doc.text(`Total Discount: Rs. ${summary.totalDiscount.toFixed(2)}`, 130, finalY + 7);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text(`GRAND TOTAL: Rs. ${summary.grandTotal.toFixed(2)}`, 130, finalY + 16);
    
    // Savings Message
    doc.setFontSize(11);
    doc.setTextColor(22, 163, 74);
    doc.text(`You saved a total of Rs. ${summary.totalSavings.toFixed(2)} on this bill!`, 105, finalY + 30, { align: 'center' });

    // Signature for Customer Copy
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text("Signature........................", 150, finalY + 45);

    // Acknowledgement Slip (at the bottom)
    const slipY = 230;
    (doc as any).setLineDash([2, 2], 0);
    doc.line(10, slipY, 200, slipY);
    (doc as any).setLineDash([], 0);
    
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.text("CUT HERE FOR SHOPKEEPER'S REFERENCE", 105, slipY + 5, { align: "center" });
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text("ACKNOWLEDGEMENT SLIP", 20, slipY + 15);
    
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text(`Invoice No: ${invoiceNo}`, 20, slipY + 25);
    doc.text(`Payment Mode: ${paymentMode}`, 20, slipY + 30);
    doc.text(`Customer: ${name}`, 20, slipY + 35);
    doc.text(`Contact: ${customerPhone || 'N/A'}`, 20, slipY + 40);
    
    doc.text(`Date: ${currentTime.toLocaleDateString()}`, 140, slipY + 25);
    doc.text(`Time: ${currentTime.toLocaleTimeString()}`, 140, slipY + 30);
    doc.text(`Items: ${products.reduce((s, p) => s + p.quantity, 0)}`, 140, slipY + 35);
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text(`TOTAL PAID: Rs. ${summary.grandTotal.toFixed(2)}`, 140, slipY + 45);

    // Signature for Acknowledgement Slip
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text("Signature........................", 20, slipY + 55);

    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("Generated by M Bill", 105, 290, { align: "center" });

    if (action === 'download') {
      doc.save(fileName);
      showToast("Downloaded", `Saved as ${fileName}`);
    } else {
      const pdfBlob = doc.output('blob');
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
      
      if (navigator.share && navigator.canShare({ files: [file] })) {
        navigator.share({
          files: [file],
          title: 'Invoice',
          text: `Invoice for ${name}`
        }).catch(err => console.error('Share failed', err));
      } else {
        doc.save(fileName);
        showToast("Downloaded", "Sharing not supported, downloaded instead");
      }
    }
  };

  const shareSMS = () => {
    if (products.length === 0) {
      showToast("Empty", "No items to share", "error");
      return;
    }

    const name = customerName || "Walk-in";
    let text = `🏪 M BILL 🧾\nInvoice: ${invoiceNo}\nPayment Mode: ${paymentMode}\nCustomer: ${name}\nContact: ${customerPhone || 'N/A'}\n${currentTime.toLocaleString()}\n------------------\n`;
    
    products.forEach(p => {
      text += `${p.serialNumber}. ${p.name} x${p.quantity} @ Rs.${p.price} (${p.discountPercent}% off) = Rs.${p.amount.toFixed(2)}\n`;
    });
    
    text += `------------------\nSubtotal: Rs.${summary.subtotal.toFixed(2)}\nTotal Discount: Rs.${summary.totalDiscount.toFixed(2)}\n💰 GRAND TOTAL: Rs.${summary.grandTotal.toFixed(2)}\n💸 You Saved: Rs.${summary.totalSavings.toFixed(2)}\nThank you!`;

    if (navigator.share) {
      navigator.share({
        title: 'Bill Summary',
        text: text
      }).catch(err => console.error('Share failed', err));
    } else {
      navigator.clipboard.writeText(text);
      showToast("Copied", "Bill text ready for SMS");
    }
  };

  return (
    <div className="bg-pattern min-h-screen">
      <div className="grid-pattern min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-50 backdrop-blur-xl bg-bg/90 border-b border-border">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <img src={logo} alt="M Bill Logo" className="w-10 h-10 rounded-xl object-contain shadow-lg" />
                <div>
                  <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-600 to-blue-600">M Bill</h1>
                  <p className="text-xs text-fg-muted">Smart Billing with Discount Tracker</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="px-3 py-1.5 rounded-lg bg-bg-secondary border border-slate-200 text-sm font-mono text-fg">
                  {currentTime.toLocaleString()}
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-bg-secondary text-sm border border-slate-200">
                  <span className="text-fg-muted">Items:</span>
                  <span className="font-semibold text-fg ml-1">{products.reduce((s, p) => s + p.quantity, 0)}</span>
                </div>
                <button 
                  onClick={clearAllProducts}
                  className="p-2 rounded-lg bg-bg-secondary border border-slate-200 hover:bg-accent-pink/10 hover:text-accent-pink hover:border-accent-pink/30 transition-colors"
                  title="Clear All"
                >
                  <Trash className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 py-6">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Left Column: Scanner & Manual Entry */}
            <div className="space-y-4">
              <div className="card rounded-2xl overflow-hidden border-accent-blue/10">
                <div className="p-4 border-b border-slate-200/60">
                  <h2 className="font-semibold text-lg flex items-center gap-2">
                    <Camera className="w-5 h-5 text-accent-pink" />
                    QR Scanner
                  </h2>
                  <p className="text-xs text-fg-muted mt-1">Format: S.No, Product Name, Qty, Price, Discount%, Amount</p>
                </div>
                
                <div className="p-4 space-y-3">
                  <button 
                    onClick={startScanner}
                    className="btn-primary w-full py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2"
                  >
                    <Camera className="w-5 h-5" />
                    <span>Start Camera</span>
                  </button>
                  
                  {/* Manual Entry */}
                  <details className="group">
                    <summary className="cursor-pointer text-sm text-fg-muted hover:text-white transition-colors flex items-center gap-2 py-2">
                      <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                      Manual Product Entry
                    </summary>
                    <div className="mt-3 space-y-3 p-4 rounded-xl bg-bg/30 border border-slate-200">
                      <input 
                        type="text" 
                        placeholder="Product Name" 
                        className="input-field w-full px-4 py-2.5 rounded-lg text-fg placeholder-slate-400"
                        value={manualEntry.name}
                        onChange={(e) => setManualEntry({ ...manualEntry, name: e.target.value })}
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <input 
                          type="number" 
                          placeholder="Qty" 
                          className="input-field w-full px-4 py-2.5 rounded-lg text-fg placeholder-slate-400"
                          value={manualEntry.qty}
                          onChange={(e) => setManualEntry({ ...manualEntry, qty: e.target.value })}
                        />
                        <input 
                          type="number" 
                          placeholder="Price (Rs.)" 
                          className="input-field w-full px-4 py-2.5 rounded-lg text-fg placeholder-slate-400"
                          value={manualEntry.price}
                          onChange={(e) => setManualEntry({ ...manualEntry, price: e.target.value })}
                        />
                      </div>
                      <input 
                        type="number" 
                        placeholder="Final Amount after discount (Rs.)" 
                        className="input-field w-full px-4 py-2.5 rounded-lg text-fg placeholder-slate-400"
                        value={manualEntry.amount}
                        onChange={(e) => setManualEntry({ ...manualEntry, amount: e.target.value })}
                      />
                      <button 
                        onClick={handleManualAdd}
                        className="w-full py-2.5 rounded-lg bg-accent-blue hover:bg-blue-500 font-medium transition-colors text-white"
                      >
                        ➕ Add Product
                      </button>
                    </div>
                  </details>

                  {/* Demo QR Examples */}
                  <div className="pt-2">
                    <p className="text-xs text-slate-500 mb-2">📱 Demo: Click to simulate QR scan</p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      <button 
                        onClick={() => handleScan('1, Regular Maggi 100g, 1, 50, 50%, 25')}
                        className="text-xs px-3 py-1.5 rounded-lg bg-bg-secondary hover:bg-accent-pink/20 hover:text-pink-300 border border-slate-700 transition-colors"
                      >
                        Maggi (50% off)
                      </button>
                      <button 
                        onClick={() => handleScan('2, Coca Cola 500ml, 2, 40, 0%, 80')}
                        className="text-xs px-3 py-1.5 rounded-lg bg-bg-secondary hover:bg-accent-blue/20 hover:text-blue-300 border border-slate-700 transition-colors"
                      >
                        Coke (No disc)
                      </button>
                      <button 
                        onClick={() => handleScan('3, Lays Classic, 1, 60, 20%, 48')}
                        className="text-xs px-3 py-1.5 rounded-lg bg-bg-secondary hover:bg-accent-green/20 hover:text-green-300 border border-slate-700 transition-colors"
                      >
                        Lays (20% off)
                      </button>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs text-slate-500">🧪 Quick Test: Paste your QR text here</p>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          placeholder="1, Product, 1, 100, 10%, 90" 
                          className="input-field flex-1 px-3 py-2 rounded-lg text-xs text-fg placeholder:text-slate-400"
                          value={quickPaste}
                          onChange={(e) => setQuickPaste(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleQuickPaste()}
                        />
                        <button 
                          onClick={handleQuickPaste}
                          className="px-3 py-2 rounded-lg bg-accent-blue hover:bg-blue-500 text-xs font-bold text-white transition-colors"
                        >
                          Process
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Bill & Summary */}
            <div className="space-y-4">
              {/* Customer Info */}
              <div className="card rounded-2xl p-4 border-accent-pink/20">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-accent-pink/10 flex items-center justify-center">
                      <User className="w-5 h-5 text-accent-pink" />
                    </div>
                    <div className="flex-1">
                      <input 
                        type="text" 
                        placeholder="Customer Name" 
                        className="input-field w-full px-3 py-2 rounded-lg text-fg placeholder:text-slate-400 text-sm"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-bg-secondary flex items-center justify-center">
                        <Phone className="w-4 h-4 text-accent-blue" />
                      </div>
                      <input 
                        type="tel" 
                        placeholder="Contact Number" 
                        className="input-field flex-1 px-3 py-1.5 rounded-lg text-fg placeholder:text-slate-400 text-xs"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-bg-secondary flex items-center justify-center">
                        <Hash className="w-4 h-4 text-accent-green" />
                      </div>
                      <input 
                        type="text" 
                        placeholder="Invoice No." 
                        className="input-field flex-1 px-3 py-1.5 rounded-lg text-fg placeholder:text-slate-400 text-xs"
                        value={invoiceNo}
                        onChange={(e) => setInvoiceNo(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-accent-blue/10 flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-accent-blue" />
                    </div>
                    <div className="flex-1 flex items-center gap-3">
                      <label className="text-sm font-medium text-fg-muted whitespace-nowrap">Payment Mode:</label>
                      <select 
                        className="input-field flex-1 px-3 py-2 rounded-lg text-fg text-sm cursor-pointer"
                        value={paymentMode}
                        onChange={(e) => setPaymentMode(e.target.value)}
                      >
                        <option value="Cash">Cash</option>
                        <option value="UPI">UPI</option>
                        <option value="Not Paid, Pending">Not Paid, Pending</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Product List */}
              <div className="card rounded-2xl overflow-hidden border-accent-blue/10">
                <div className="p-4 border-b border-slate-200/60">
                  <h2 className="font-semibold text-lg flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-accent-blue" />
                    Product List
                    <span className="text-xs text-fg-muted ml-2">(Update Qty / Remove)</span>
                  </h2>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  <AnimatePresence initial={false}>
                    {products.length === 0 ? (
                      <div className="p-8 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-bg-secondary border border-slate-200 flex items-center justify-center">
                          <ShoppingCart className="w-8 h-8 text-slate-400" />
                        </div>
                        <p className="text-fg-muted">No products scanned yet</p>
                        <p className="text-xs text-slate-400 mt-1">Scan QR or add manually</p>
                      </div>
                    ) : (
                      products.map((p) => (
                        <motion.div 
                          key={p.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className="p-4 border-b border-slate-200/40 hover:bg-bg-secondary/50 transition-colors"
                        >
                          <div className="flex justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs text-fg-muted">#{p.serialNumber}</span>
                                {p.discountPercent > 0 && (
                                  <span className="discount-badge text-[10px] px-2 py-0.5 rounded-full text-white font-bold">
                                    {p.discountPercent}% OFF
                                  </span>
                                )}
                              </div>
                              <h3 className="font-medium text-fg truncate">{p.name}</h3>
                              <div className="flex items-center gap-3 mt-2">
                                <span className="text-fg-muted text-sm">Rs.{p.price.toFixed(2)} x</span>
                                <div className="flex items-center gap-1 bg-bg-secondary rounded-lg border border-slate-200">
                                  <button 
                                    onClick={() => updateQuantity(p.id, -1)}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-fg-muted hover:bg-accent-blue hover:text-white transition-colors"
                                  >
                                    <Minus size={14} />
                                  </button>
                                  <span className="w-8 text-center text-fg text-sm">{p.quantity}</span>
                                  <button 
                                    onClick={() => updateQuantity(p.id, 1)}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-fg-muted hover:bg-accent-blue hover:text-white transition-colors"
                                  >
                                    <Plus size={14} />
                                  </button>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-fg">Rs.{p.amount.toFixed(2)}</p>
                              {p.discountPercent > 0 && (
                                <p className="text-[10px] text-accent-green">
                                  Save Rs.{((p.price * p.quantity) - p.amount).toFixed(2)}
                                </p>
                              )}
                              <button 
                                onClick={() => removeProduct(p.id)}
                                className="text-xs text-accent-pink hover:text-pink-300 mt-1"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Bill Summary */}
              <div className="card rounded-2xl overflow-hidden border-accent-green/10">
                <div className="p-4 border-b border-slate-200/60">
                  <h2 className="font-semibold text-lg flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-accent-green" />
                    Bill Summary
                  </h2>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex justify-between text-fg-muted text-sm">
                    <span>Subtotal (Before Discount)</span>
                    <span className="font-medium text-fg">Rs.{summary.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-fg-muted text-sm">
                    <span>Total Discount on Products</span>
                    <span className="font-medium text-accent-pink">Rs.{summary.totalDiscount.toFixed(2)}</span>
                  </div>
                  
                  <div className="savings-box rounded-xl p-3 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-accent-green" />
                      <span className="text-accent-green font-bold text-sm">💰 YOU SAVE TOTAL</span>
                    </div>
                    <span className="font-bold text-accent-green text-xl">Rs.{summary.totalSavings.toFixed(2)}</span>
                  </div>

                  <div className="border-t border-slate-200 pt-3 flex justify-between items-center">
                    <span className="text-fg-muted font-semibold">GRAND TOTAL</span>
                    <span className="font-display font-bold text-2xl text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-blue-600">
                      Rs.{summary.grandTotal.toFixed(2)}
                    </span>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="grid grid-cols-3 gap-2 pt-3">
                    <button 
                      onClick={() => generatePDF('share')}
                      className="btn-pink py-2.5 rounded-xl font-semibold text-white flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider"
                    >
                      <Share2 className="w-4 h-4" />
                      1. Share PDF
                    </button>
                    <button 
                      onClick={() => generatePDF('download')}
                      className="btn-checkout py-2.5 rounded-xl font-semibold text-white flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider"
                    >
                      <Download className="w-4 h-4" />
                      2. Download PDF
                    </button>
                    <button 
                      onClick={shareSMS}
                      className="btn-primary py-2.5 rounded-xl font-semibold text-white flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider"
                    >
                      <MessageSquare className="w-4 h-4" />
                      3. Share Text
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Scanner Modal */}
        <AnimatePresence>
          {isScannerOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-bg/95 backdrop-blur-md flex flex-col items-center justify-center p-6"
            >
              <button 
                onClick={stopScanner}
                className="absolute top-6 right-6 text-fg-muted hover:text-white transition-colors"
              >
                <X size={32} />
              </button>
              
              <div className="w-full max-w-md aspect-square rounded-3xl overflow-hidden bg-slate-100 border-2 border-accent-blue/20 relative">
                <div id="qr-reader" className="w-full h-full"></div>
                
                {/* Error State */}
                {scannerError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-white/90 text-center">
                    <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                    <p className="text-fg font-medium mb-2">Camera Error</p>
                    <p className="text-xs text-slate-500 mb-6">{scannerError}</p>
                    <button 
                      onClick={() => {
                        stopScanner();
                        setTimeout(startScanner, 100);
                      }}
                      className="px-6 py-2 rounded-xl bg-accent-blue text-white text-sm font-bold"
                    >
                      Retry
                    </button>
                  </div>
                )}

                {/* Scanning Overlay */}
                {!scannerError && (
                  <div className="absolute inset-0 pointer-events-none border-[40px] border-bg/60">
                    <div className="w-full h-full border-2 border-accent-blue relative">
                      <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-accent-blue"></div>
                      <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-accent-blue"></div>
                      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-accent-blue"></div>
                      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-accent-blue"></div>
                      <motion.div 
                        animate={{ y: [0, 250, 0] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="w-full h-0.5 bg-accent-blue shadow-[0_0_15px_rgba(59,130,246,0.8)]"
                      />
                    </div>
                  </div>
                )}
              </div>
              
              <p className="text-white mt-8 text-center font-medium">
                Align QR code within the frame to scan
              </p>
              <p className="text-fg-muted text-xs mt-2">
                Format: S.No, Name, Qty, Price, Disc%, Amount
              </p>

              {lastScanned && (
                <div className="mt-6 p-3 rounded-xl bg-bg-secondary border border-slate-700 max-w-xs w-full">
                  <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Last Decoded Text:</p>
                  <p className="text-xs text-white break-all font-mono">{lastScanned}</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toast Notification */}
        <AnimatePresence>
          {toast && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-6 right-6 z-[70] pointer-events-none"
            >
              <div className="px-4 py-3 rounded-xl bg-bg-secondary border border-slate-700 shadow-2xl flex items-center gap-3">
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center",
                  toast.type === 'success' ? "bg-accent-green/20" : 
                  toast.type === 'warning' ? "bg-accent-pink/20" : "bg-red-500/20"
                )}>
                  {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-accent-green" /> : 
                   toast.type === 'warning' ? <AlertCircle className="w-5 h-5 text-accent-pink" /> : 
                   <AlertCircle className="w-5 h-5 text-red-400" />}
                </div>
                <div>
                  <p className="font-medium text-white text-sm">{toast.title}</p>
                  <p className="text-xs text-fg-muted">{toast.message}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
