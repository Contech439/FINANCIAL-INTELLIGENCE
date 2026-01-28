'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../utils/supabase/client'

export default function SettingsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [orgData, setOrgData] = useState<any>({})

  useEffect(() => {
    fetchOrg()
  }, [])

  const fetchOrg = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if(!user) return
    const { data: members } = await supabase.from('organization_members').select('organization_id').eq('user_id', user.id).single()
    
    if(members) {
        const { data } = await supabase.from('organizations').select('*').eq('id', members.organization_id).single()
        if(data) setOrgData(data)
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
        const { error } = await supabase
            .from('organizations')
            .update({
                name: orgData.name,
                address: orgData.address,
                phone: orgData.phone,
                email: orgData.email,
                // Di real app, logo_url biasanya hasil upload file. Di sini kita pakai text URL dulu.
                logo_url: orgData.logo_url 
            })
            .eq('id', orgData.id)

        if(error) throw error
        alert('Profil Perusahaan Berhasil Diupdate!')
    } catch (err: any) {
        alert('Gagal: ' + err.message)
    } finally {
        setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-8">
        <h1 className="text-2xl font-bold mb-6 text-gray-800 border-b pb-4">Pengaturan Perusahaan (Kop Surat)</h1>
        
        <form onSubmit={handleUpdate} className="space-y-5">
            <div>
                <label className="block text-sm font-bold text-gray-700">Nama Perusahaan</label>
                <input type="text" className="w-full border rounded p-2" value={orgData.name || ''} onChange={e => setOrgData({...orgData, name: e.target.value})} />
            </div>
            
            <div>
                <label className="block text-sm font-bold text-gray-700">Alamat Lengkap</label>
                <textarea rows={3} className="w-full border rounded p-2" value={orgData.address || ''} onChange={e => setOrgData({...orgData, address: e.target.value})} placeholder="Alamat ini akan muncul di Kop Surat/Invoice" />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-bold text-gray-700">No. Telepon / WA</label>
                    <input type="text" className="w-full border rounded p-2" value={orgData.phone || ''} onChange={e => setOrgData({...orgData, phone: e.target.value})} />
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700">Email Publik</label>
                    <input type="text" className="w-full border rounded p-2" value={orgData.email || ''} onChange={e => setOrgData({...orgData, email: e.target.value})} />
                </div>
            </div>

            <div>
                <label className="block text-sm font-bold text-gray-700">URL Logo Perusahaan (Opsional)</label>
                <input type="text" className="w-full border rounded p-2 text-sm" value={orgData.logo_url || ''} onChange={e => setOrgData({...orgData, logo_url: e.target.value})} placeholder="https://..." />
                <p className="text-xs text-gray-500 mt-1">Masukkan link gambar logo Anda agar muncul di cetakan PDF.</p>
            </div>

            <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded font-bold hover:bg-blue-700">
                {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
        </form>
      </div>
    </div>
  )
}